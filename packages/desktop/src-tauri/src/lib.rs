mod bun_env;
mod bundled_tools;
mod commands;
mod config;
mod engine;
mod fs;
mod opencode_router;
mod openwork_server;
mod opkg;
mod orchestrator;
mod paths;
mod platform;
mod types;
mod updater;
mod utils;
mod workspace;

pub use types::*;

use commands::command_files::{
    opencode_command_delete, opencode_command_list, opencode_command_write,
};
use commands::config::{read_opencode_config, write_opencode_config};
use commands::engine::{
    engine_doctor, engine_info, engine_install, engine_restart, engine_start, engine_stop,
};
use commands::misc::{
    app_build_info, nuke_opencode_dev_config_and_exit, obsidian_is_available, open_in_obsidian,
    opencode_db_migrate, opencode_mcp_auth, read_obsidian_mirror_file, reset_opencode_cache,
    reset_openwork_state, write_obsidian_mirror_file,
};
use commands::opencode_router::{
    opencodeRouter_config_set, opencodeRouter_info, opencodeRouter_start, opencodeRouter_status,
    opencodeRouter_stop,
};
use commands::openwork_server::{openwork_server_info, openwork_server_restart};
use commands::opkg::{import_skill, opkg_install};
use commands::orchestrator::{
    orchestrator_instance_dispose, orchestrator_start_detached, orchestrator_status,
    orchestrator_workspace_activate, sandbox_cleanup_openwork_containers, sandbox_debug_probe,
    sandbox_doctor, sandbox_stop,
};
use commands::scheduler::{scheduler_delete_job, scheduler_list_jobs};
use commands::skills::{
    install_skill_template, list_local_skills, read_local_skill, uninstall_skill, write_local_skill,
};
use commands::updater::updater_environment;
use commands::window::set_window_decorations;
use commands::workspace::{
    workspace_add_authorized_root, workspace_bootstrap, workspace_create, workspace_create_remote,
    workspace_export_config, workspace_forget, workspace_import_config, workspace_openwork_read,
    workspace_openwork_write, workspace_set_active, workspace_update_display_name,
    workspace_update_remote,
};
use engine::manager::EngineManager;
use opencode_router::manager::OpenCodeRouterManager;
use openwork_server::manager::OpenworkServerManager;
use orchestrator::manager::OrchestratorManager;
use tauri::Manager;
use workspace::watch::WorkspaceWatchState;

#[cfg(target_os = "macos")]
fn set_dev_app_name() {
    if std::env::var("OPENWORK_DEV_MODE").ok().as_deref() != Some("1") {
        return;
    }

    let Some(_mtm) = objc2::MainThreadMarker::new() else {
        return;
    };

    objc2_foundation::NSProcessInfo::processInfo()
        .setProcessName(&objc2_foundation::NSString::from_str("Abel - Dev"));
}

#[cfg(not(target_os = "macos"))]
fn set_dev_app_name() {}

fn stop_managed_services(app_handle: &tauri::AppHandle) {
    if let Ok(mut engine) = app_handle.state::<EngineManager>().inner.lock() {
        EngineManager::stop_locked(&mut engine);
    }
    if let Ok(mut orchestrator) = app_handle.state::<OrchestratorManager>().inner.lock() {
        OrchestratorManager::stop_locked(&mut orchestrator);
    }
    if let Ok(mut openwork_server) = app_handle.state::<OpenworkServerManager>().inner.lock() {
        OpenworkServerManager::stop_locked(&mut openwork_server);
    }
    if let Ok(mut opencode_router) = app_handle.state::<OpenCodeRouterManager>().inner.lock() {
        OpenCodeRouterManager::stop_locked(&mut opencode_router);
    }
}

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    let app = builder
        .setup(|app| {
            set_dev_app_name();
            if let Err(e) = bundled_tools::ensure_bundled_tools(app.handle()) {
                eprintln!("[abel] Error: bundled tools setup failed: {e}");
                // Show user-facing error dialog so the user knows why child processes
                // will fail, instead of silently launching a broken app.
                let msg = format!(
                    "Abel could not set up required tools.\n\n\
                     Error: {}\n\n\
                     Please ensure you have enough disk space and restart Abel.\n\
                     If this persists, try deleting the Abel data folder and restarting.",
                    e
                );
                if let Some(window) = app.get_webview_window("main") {
                    use tauri_plugin_dialog::DialogExt;
                    window.dialog()
                        .message(&msg)
                        .title("Abel Setup Error")
                        .blocking_show();
                } else {
                    eprintln!("[abel] {msg}");
                }
            }
            Ok(())
        })
        .manage(EngineManager::default())
        .manage(OrchestratorManager::default())
        .manage(OpenworkServerManager::default())
        .manage(OpenCodeRouterManager::default())
        .manage(WorkspaceWatchState::default())
        .invoke_handler(tauri::generate_handler![
            engine_start,
            engine_stop,
            engine_info,
            engine_doctor,
            engine_install,
            engine_restart,
            orchestrator_status,
            orchestrator_workspace_activate,
            orchestrator_instance_dispose,
            orchestrator_start_detached,
            sandbox_doctor,
            sandbox_debug_probe,
            sandbox_stop,
            sandbox_cleanup_openwork_containers,
            openwork_server_info,
            openwork_server_restart,
            opencodeRouter_info,
            opencodeRouter_start,
            opencodeRouter_stop,
            opencodeRouter_status,
            opencodeRouter_config_set,
            workspace_bootstrap,
            workspace_set_active,
            workspace_create,
            workspace_create_remote,
            workspace_update_display_name,
            workspace_update_remote,
            workspace_forget,
            workspace_add_authorized_root,
            workspace_export_config,
            workspace_import_config,
            opencode_command_list,
            opencode_command_write,
            opencode_command_delete,
            workspace_openwork_read,
            workspace_openwork_write,
            opkg_install,
            import_skill,
            install_skill_template,
            list_local_skills,
            read_local_skill,
            uninstall_skill,
            write_local_skill,
            read_opencode_config,
            write_opencode_config,
            updater_environment,
            app_build_info,
            nuke_opencode_dev_config_and_exit,
            obsidian_is_available,
            open_in_obsidian,
            write_obsidian_mirror_file,
            read_obsidian_mirror_file,
            reset_openwork_state,
            reset_opencode_cache,
            opencode_db_migrate,
            opencode_mcp_auth,
            scheduler_list_jobs,
            scheduler_delete_job,
            set_window_decorations
        ])
        .build(tauri::generate_context!())
        .expect("error while building Abel");

    // Best-effort cleanup on app exit. Without this, background sidecars can keep
    // running after the UI quits (especially during dev), leading to multiple
    // orchestrator/opencode/openwork-server processes and stale ports.
    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
            stop_managed_services(&app_handle);
        }
        tauri::RunEvent::WindowEvent {
            event: tauri::WindowEvent::CloseRequested { .. },
            ..
        } => {
            stop_managed_services(&app_handle);
        }
        _ => {}
    });
}
