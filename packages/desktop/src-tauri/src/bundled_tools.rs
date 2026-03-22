//! Manages portable Node.js, Python, and git bundled inside the Abel app.
//!
//! At build time, `prepare-bundled-tools.mjs` downloads platform-specific
//! Node.js and git distributions into `src-tauri/bundled-tools/`. Tauri's
//! resource bundling copies these into the app bundle.
//!
//! On first launch (or after an app update that ships newer tool versions),
//! this module copies the bundled tools from the read-only resource directory
//! to a writable location (`$APP_DATA_DIR/bundled-tools/`), then returns
//! the `bin` directory paths for injection into child process PATH.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const VERSIONS_FILE: &str = "versions.json";

/// Returns the writable directory where bundled tools are extracted.
fn tools_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("bundled-tools"))
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}

/// Returns the read-only resource directory where tools are bundled.
fn tools_resource_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|p| p.join("bundled-tools"))
}

/// Check if the extracted tools match the bundled version.
fn needs_extraction(resource_dir: &Path, data_dir: &Path) -> bool {
    let bundled_versions = resource_dir.join(VERSIONS_FILE);
    let extracted_versions = data_dir.join(VERSIONS_FILE);

    let bundled = match fs::read_to_string(&bundled_versions) {
        Ok(content) => content,
        Err(_) => return true, // Read failed after exists() check; re-extract to be safe
    };

    let extracted = match fs::read_to_string(&extracted_versions) {
        Ok(content) => content,
        Err(_) => return true, // Not yet extracted
    };

    bundled.trim() != extracted.trim()
}

/// Recursively copy a directory tree.
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Ok(());
    }

    fs::create_dir_all(dst).map_err(|e| format!("mkdir {}: {e}", dst.display()))?;

    let entries =
        fs::read_dir(src).map_err(|e| format!("read_dir {}: {e}", src.display()))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("dir entry: {e}"))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        // Preserve symlinks instead of dereferencing them.
        // This is critical for Node.js npm/npx which use symlinks like:
        //   bin/npx -> ../lib/node_modules/npm/bin/npx-cli.js
        // If dereferenced, the copied file's require('../lib/cli.js') resolves
        // from the wrong directory, breaking npx entirely.
        #[cfg(unix)]
        {
            let metadata = fs::symlink_metadata(&src_path)
                .map_err(|e| format!("symlink_metadata {}: {e}", src_path.display()))?;

            if metadata.file_type().is_symlink() {
                let target = fs::read_link(&src_path)
                    .map_err(|e| format!("read_link {}: {e}", src_path.display()))?;
                // Use std::os::unix::fs::symlink to create a symlink at dst
                std::os::unix::fs::symlink(&target, &dst_path)
                    .map_err(|e| format!("symlink {} -> {}: {e}", dst_path.display(), target.display()))?;
                continue;
            }
        }

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("copy {} -> {}: {e}", src_path.display(), dst_path.display()))?;

            // Preserve executable permission on unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = fs::metadata(&src_path) {
                    let mode = metadata.permissions().mode();
                    if mode & 0o111 != 0 {
                        let _ = fs::set_permissions(&dst_path, std::fs::Permissions::from_mode(mode));
                    }
                }
            }
        }
    }

    Ok(())
}

/// On macOS, ad-hoc codesign extracted binaries so Gatekeeper allows them.
#[cfg(target_os = "macos")]
fn adhoc_codesign_dir(dir: &Path) {
    if !dir.is_dir() {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            adhoc_codesign_dir(&path);
            continue;
        }

        // Only sign executable files
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(&path) {
                if meta.permissions().mode() & 0o111 == 0 {
                    continue;
                }
            }
        }

        // Check if it's a Mach-O binary (starts with magic bytes).
        // Only read the first 4 bytes instead of the entire file.
        {
            use std::io::Read;
            let Ok(mut file) = std::fs::File::open(&path) else {
                continue;
            };
            let mut magic_bytes = [0u8; 4];
            if file.read_exact(&mut magic_bytes).is_err() {
                continue;
            }
            let magic = u32::from_be_bytes(magic_bytes);
            let is_macho = matches!(
                magic,
                0xFEEDFACE | 0xFEEDFACF | 0xCAFEBABE | 0xCEFAEDFE | 0xCFFAEDFE
            );
            if !is_macho {
                continue;
            }
        }

        let _ = std::process::Command::new("codesign")
            .args(["--sign", "-", "--force", "--preserve-metadata=entitlements,requirements,flags"])
            .arg(&path)
            .output();
    }
}

/// Extract bundled tools from resource dir to writable data dir.
/// This is called once on first launch or after an app update.
pub fn ensure_bundled_tools(app: &AppHandle) -> Result<(), String> {
    let resource_dir = match tools_resource_dir(app) {
        Some(d) if d.join(VERSIONS_FILE).exists() => d,
        _ => {
            // No bundled tools in this build (dev mode or ABEL_SKIP_BUNDLED_TOOLS)
            return Ok(());
        }
    };

    let data_dir = tools_data_dir(app)?;

    if !needs_extraction(&resource_dir, &data_dir) {
        return Ok(());
    }

    eprintln!("[abel] Extracting bundled tools (first launch)...");

    // Extract to a temp directory first, then atomically rename.
    // This avoids a race condition when two app instances launch simultaneously.
    let tmp_dir = data_dir.with_extension("installing");
    if tmp_dir.exists() {
        let _ = fs::remove_dir_all(&tmp_dir);
    }

    copy_dir_recursive(&resource_dir, &tmp_dir)?;

    // Ad-hoc codesign on macOS
    #[cfg(target_os = "macos")]
    {
        eprintln!("[abel] Codesigning bundled tools...");
        adhoc_codesign_dir(&tmp_dir.join("node"));
        adhoc_codesign_dir(&tmp_dir.join("git"));
        adhoc_codesign_dir(&tmp_dir.join("python"));
    }

    // Fix npm/npx symlinks — Tauri's resource bundler dereferences symlinks,
    // so bin/npx is a copy of npx-cli.js instead of a symlink. This breaks
    // require('../lib/cli.js') resolution because the file is now at bin/npx
    // instead of lib/node_modules/npm/bin/npx-cli.js.
    #[cfg(unix)]
    fix_npm_symlinks(&tmp_dir);

    // Create npm config for writable prefix
    setup_npm_config(&tmp_dir)?;

    // Atomic swap: remove old, rename temp to final
    if data_dir.exists() {
        let _ = fs::remove_dir_all(&data_dir);
    }
    fs::rename(&tmp_dir, &data_dir)
        .map_err(|e| format!("Failed to install bundled tools: {e}"))?;

    eprintln!("[abel] Bundled tools ready.");
    Ok(())
}

/// Fix npm/npx bin shims that were dereferenced by Tauri's resource bundler.
///
/// In a normal Node.js distribution:
///   bin/npx -> ../lib/node_modules/npm/bin/npx-cli.js
///   bin/npm -> ../lib/node_modules/npm/bin/npm-cli.js
///
/// After Tauri bundles them as resources, these become regular files containing
/// the content of npx-cli.js / npm-cli.js. But those scripts use
/// `require('../lib/cli.js')` which resolves relative to the script's location.
/// When the file is at `bin/npx`, it looks for `lib/cli.js` (doesn't exist).
/// When it's a symlink to `lib/node_modules/npm/bin/npx-cli.js`, it correctly
/// finds `lib/node_modules/npm/lib/cli.js`.
#[cfg(unix)]
fn fix_npm_symlinks(data_dir: &Path) {
    let bin_dir = data_dir.join("node").join("bin");
    let npm_bin = data_dir.join("node").join("lib").join("node_modules").join("npm").join("bin");

    let links: &[(&str, &str)] = &[
        ("npx", "npx-cli.js"),
        ("npm", "npm-cli.js"),
    ];

    for (name, target_file) in links {
        let link_path = bin_dir.join(name);
        let target = npm_bin.join(target_file);

        // Only fix if the target exists and the link is currently a regular file
        if !target.exists() {
            continue;
        }
        if let Ok(meta) = fs::symlink_metadata(&link_path) {
            if meta.file_type().is_symlink() {
                continue; // Already a symlink, nothing to fix
            }
        }

        // Remove the dereferenced copy and create a proper symlink
        let relative_target = format!("../lib/node_modules/npm/bin/{}", target_file);
        let _ = fs::remove_file(&link_path);
        if let Err(e) = std::os::unix::fs::symlink(&relative_target, &link_path) {
            eprintln!("[abel] Warning: could not fix {} symlink: {e}", name);
        }
    }
}

/// Create .npmrc so npm install -g uses a writable prefix.
fn setup_npm_config(data_dir: &Path) -> Result<(), String> {
    let global_dir = data_dir.join("node-global");
    let cache_dir = data_dir.join("npm-cache");

    fs::create_dir_all(&global_dir).map_err(|e| format!("mkdir node-global: {e}"))?;
    fs::create_dir_all(&cache_dir).map_err(|e| format!("mkdir npm-cache: {e}"))?;

    // Write .npmrc next to the node binary
    let npmrc_path = data_dir.join("node").join(".npmrc");
    let npmrc_content = format!(
        "prefix={}\ncache={}\n",
        global_dir.to_string_lossy(),
        cache_dir.to_string_lossy()
    );
    fs::write(&npmrc_path, npmrc_content)
        .map_err(|e| format!("write .npmrc: {e}"))?;

    Ok(())
}

/// Returns the bin directories for bundled Node.js and git.
/// These should be prepended to PATH for all child processes.
pub fn bundled_tool_paths(app: &AppHandle) -> Vec<PathBuf> {
    let data_dir = match tools_data_dir(app) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    if !data_dir.join(VERSIONS_FILE).exists() {
        return Vec::new();
    }

    let mut paths = Vec::new();

    // Node.js bin
    #[cfg(not(windows))]
    let node_bin = data_dir.join("node").join("bin");
    #[cfg(windows)]
    let node_bin = data_dir.join("node");

    if node_bin.is_dir() {
        paths.push(node_bin);
    }

    // npm global bin (for packages installed via npm install -g)
    #[cfg(not(windows))]
    let npm_global_bin = data_dir.join("node-global").join("bin");
    #[cfg(windows)]
    let npm_global_bin = data_dir.join("node-global");

    if npm_global_bin.is_dir() {
        paths.push(npm_global_bin);
    }

    // Python bin
    #[cfg(not(windows))]
    let python_bin = data_dir.join("python").join("bin");
    #[cfg(windows)]
    let python_bin = data_dir.join("python");

    if python_bin.is_dir() {
        paths.push(python_bin);
    }

    // Git bin
    #[cfg(not(windows))]
    let git_bin = data_dir.join("git").join("bin");
    #[cfg(windows)]
    let git_bin = data_dir.join("git").join("cmd");

    if git_bin.is_dir() {
        paths.push(git_bin);
    }

    paths
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_needs_extraction_both_missing() {
        let tmp = std::env::temp_dir().join("abel-test-needs-extraction-missing");
        let resource_dir = tmp.join("resource");
        let data_dir = tmp.join("data");
        // Neither dir exists — should need extraction
        assert!(needs_extraction(&resource_dir, &data_dir));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_needs_extraction_matching_versions() {
        let tmp = std::env::temp_dir().join("abel-test-needs-extraction-match");
        let resource_dir = tmp.join("resource");
        let data_dir = tmp.join("data");

        fs::create_dir_all(&resource_dir).unwrap();
        fs::create_dir_all(&data_dir).unwrap();

        let content = r#"{"node":"22.16.0","target":"aarch64-apple-darwin"}"#;
        fs::write(resource_dir.join(VERSIONS_FILE), content).unwrap();
        fs::write(data_dir.join(VERSIONS_FILE), content).unwrap();

        assert!(!needs_extraction(&resource_dir, &data_dir));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_needs_extraction_different_versions() {
        let tmp = std::env::temp_dir().join("abel-test-needs-extraction-diff");
        let resource_dir = tmp.join("resource");
        let data_dir = tmp.join("data");

        fs::create_dir_all(&resource_dir).unwrap();
        fs::create_dir_all(&data_dir).unwrap();

        fs::write(resource_dir.join(VERSIONS_FILE), r#"{"node":"22.17.0"}"#).unwrap();
        fs::write(data_dir.join(VERSIONS_FILE), r#"{"node":"22.16.0"}"#).unwrap();

        assert!(needs_extraction(&resource_dir, &data_dir));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_needs_extraction_data_not_extracted() {
        let tmp = std::env::temp_dir().join("abel-test-needs-extraction-nodata");
        let resource_dir = tmp.join("resource");
        let data_dir = tmp.join("data");

        fs::create_dir_all(&resource_dir).unwrap();
        fs::write(resource_dir.join(VERSIONS_FILE), r#"{"node":"22.16.0"}"#).unwrap();
        // data_dir doesn't exist

        assert!(needs_extraction(&resource_dir, &data_dir));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_copy_dir_recursive() {
        let tmp = std::env::temp_dir().join("abel-test-copy-recursive");
        let src = tmp.join("src");
        let dst = tmp.join("dst");

        fs::create_dir_all(src.join("subdir")).unwrap();
        fs::write(src.join("file1.txt"), "hello").unwrap();
        fs::write(src.join("subdir").join("file2.txt"), "world").unwrap();

        copy_dir_recursive(&src, &dst).unwrap();

        assert!(dst.join("file1.txt").exists());
        assert!(dst.join("subdir").join("file2.txt").exists());
        assert_eq!(fs::read_to_string(dst.join("file1.txt")).unwrap(), "hello");
        assert_eq!(
            fs::read_to_string(dst.join("subdir").join("file2.txt")).unwrap(),
            "world"
        );
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_copy_dir_recursive_nonexistent_src() {
        let tmp = std::env::temp_dir().join("abel-test-copy-nosrc");
        let result = copy_dir_recursive(&tmp.join("nonexistent"), &tmp.join("dst"));
        assert!(result.is_ok()); // Non-dir src returns Ok
    }

    #[test]
    fn test_setup_npm_config() {
        let tmp = std::env::temp_dir().join("abel-test-npm-config");
        fs::create_dir_all(tmp.join("node")).unwrap();

        setup_npm_config(&tmp).unwrap();

        assert!(tmp.join("node-global").is_dir());
        assert!(tmp.join("npm-cache").is_dir());
        assert!(tmp.join("node").join(".npmrc").exists());

        let npmrc = fs::read_to_string(tmp.join("node").join(".npmrc")).unwrap();
        assert!(npmrc.contains("prefix="));
        assert!(npmrc.contains("cache="));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[cfg(unix)]
    #[test]
    fn test_copy_dir_preserves_executable_permission() {
        use std::os::unix::fs::PermissionsExt;

        let tmp = std::env::temp_dir().join("abel-test-copy-perms");
        let src = tmp.join("src");
        let dst = tmp.join("dst");

        fs::create_dir_all(&src).unwrap();
        let bin_path = src.join("script.sh");
        fs::write(&bin_path, "#!/bin/sh\necho hi").unwrap();
        fs::set_permissions(&bin_path, std::fs::Permissions::from_mode(0o755)).unwrap();

        copy_dir_recursive(&src, &dst).unwrap();

        let dst_perms = fs::metadata(dst.join("script.sh")).unwrap().permissions();
        assert_ne!(dst_perms.mode() & 0o111, 0, "Executable bit should be preserved");
        let _ = fs::remove_dir_all(&tmp);
    }
}

/// Returns environment variable overrides for npm config.
pub fn npm_env_overrides(app: &AppHandle) -> Vec<(&'static str, String)> {
    let data_dir = match tools_data_dir(app) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    if !data_dir.join(VERSIONS_FILE).exists() {
        return Vec::new();
    }

    let global_dir = data_dir.join("node-global");
    let cache_dir = data_dir.join("npm-cache");

    vec![
        ("NPM_CONFIG_PREFIX", global_dir.to_string_lossy().to_string()),
        ("NPM_CONFIG_CACHE", cache_dir.to_string_lossy().to_string()),
        ("NPM_CONFIG_USERCONFIG", data_dir.join("node").join(".npmrc").to_string_lossy().to_string()),
    ]
}
