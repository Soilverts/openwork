//! Manages portable Node.js and git bundled inside the Abel app.
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
        Err(_) => return false, // No bundled tools available
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

        // Check if it's a Mach-O binary (starts with magic bytes)
        if let Ok(bytes) = fs::read(&path) {
            if bytes.len() < 4 {
                continue;
            }
            let magic = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
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

    // Remove old extraction
    if data_dir.exists() {
        let _ = fs::remove_dir_all(&data_dir);
    }

    copy_dir_recursive(&resource_dir, &data_dir)?;

    // Ad-hoc codesign on macOS
    #[cfg(target_os = "macos")]
    {
        eprintln!("[abel] Codesigning bundled tools...");
        adhoc_codesign_dir(&data_dir.join("node"));
        adhoc_codesign_dir(&data_dir.join("git"));
    }

    // Create npm config for writable prefix
    setup_npm_config(&data_dir)?;

    eprintln!("[abel] Bundled tools ready.");
    Ok(())
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
