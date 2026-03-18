use tauri::{AppHandle, Manager};

use crate::fs::copy_dir_recursive;
use crate::opkg::opkg_install as opkg_install_inner;
use crate::paths::{prepended_path_env_with_bundled, sidecar_path_candidates};
use crate::types::ExecResult;

#[tauri::command]
pub fn opkg_install(
    app: AppHandle,
    project_dir: String,
    package: String,
) -> Result<ExecResult, String> {
    let project_dir = project_dir.trim().to_string();
    if project_dir.is_empty() {
        return Err("projectDir is required".to_string());
    }

    let package = package.trim().to_string();
    if package.is_empty() {
        return Err("package is required".to_string());
    }

    let resource_dir = app.path().resource_dir().ok();
    let current_bin_dir = tauri::process::current_binary(&app.env())
        .ok()
        .and_then(|path| path.parent().map(|p| p.to_path_buf()));
    let sidecar_paths =
        sidecar_path_candidates(resource_dir.as_deref(), current_bin_dir.as_deref());
    let bundled_paths = crate::bundled_tools::bundled_tool_paths(&app);
    let path_env = prepended_path_env_with_bundled(&sidecar_paths, &bundled_paths);

    opkg_install_inner(&project_dir, &package, path_env)
}

#[tauri::command]
pub fn import_skill(
    project_dir: String,
    source_dir: String,
    overwrite: bool,
) -> Result<ExecResult, String> {
    let project_dir = project_dir.trim().to_string();
    if project_dir.is_empty() {
        return Err("projectDir is required".to_string());
    }

    let source_dir = source_dir.trim().to_string();
    if source_dir.is_empty() {
        return Err("sourceDir is required".to_string());
    }

    let src = std::path::PathBuf::from(&source_dir);
    let name = src
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Failed to infer skill name from directory".to_string())?;

    let dest = std::path::PathBuf::from(&project_dir)
        .join(".opencode")
        .join("skills")
        .join(name);

    if dest.exists() {
        if overwrite {
            std::fs::remove_dir_all(&dest).map_err(|e| {
                format!(
                    "Failed to remove existing skill dir {}: {e}",
                    dest.display()
                )
            })?;
        } else {
            return Err(format!("Skill already exists at {}", dest.display()));
        }
    }

    copy_dir_recursive(&src, &dest)?;

    Ok(ExecResult {
        ok: true,
        status: 0,
        stdout: format!("Imported skill to {}", dest.display()),
        stderr: String::new(),
    })
}
