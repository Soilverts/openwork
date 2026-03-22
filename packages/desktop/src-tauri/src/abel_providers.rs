//! Abel default AI provider configuration.
//!
//! Ships pre-configured API keys for MiniMax and Kimi so enterprise users
//! get a working AI experience out of the box — zero manual setup.
//!
//! Priority:
//! 1. User's own env var (e.g. MINIMAX_API_KEY already set in shell)
//! 2. Runtime override: `$APP_DATA_DIR/abel-providers.json` (IT admin can swap keys)
//! 3. Compiled-in defaults below (ship with every Abel build)
//!
//! The keys are injected as environment variables when spawning the OpenCode engine.
//! OpenCode already has these providers built in — it just needs the keys to
//! mark them as "connected".

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

// ── Compiled-in default keys ─────────────────────────────────────────
// These ship with every Abel binary. IT admins can override at runtime
// via $APP_DATA_DIR/abel-providers.json without rebuilding.

const DEFAULT_MINIMAX_KEY: &str =
    "sk-cp-9xSdrN-FYNty57lmLZwqORKgrNVTtAa2lHa7ildL5vFcZGCGuKzcqcGFlay23HD2GtokIwweNjJbCUefokB9vsjIS0rzRcmeDP81yjZtx0oX1IPAOFTNg2k";

const DEFAULT_MOONSHOT_KEY: &str =
    "sk-kimi-km4lv5CLCCbJczIXY0qc9Amx5aPjWDbVjUiKX4I65kGibaeqljB9710FwEo1t7r9";

/// Allowlist of provider env var names we accept from the runtime config.
/// This prevents arbitrary env-var injection from user-writable JSON.
const ALLOWED_PROVIDER_KEYS: &[&str] = &[
    "MINIMAX_API_KEY",
    "MOONSHOT_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "DEEPSEEK_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
];

/// Path to the runtime provider config file within the app data directory.
const PROVIDER_CONFIG_FILENAME: &str = "abel-providers.json";

/// Returns the path to the runtime provider config file.
fn provider_config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(PROVIDER_CONFIG_FILENAME))
}

/// Reads API keys from the runtime config file.
/// Only returns keys that are in the allowlist.
fn read_runtime_config(app: &AppHandle) -> Vec<(String, String)> {
    let Some(path) = provider_config_path(app) else {
        return Vec::new();
    };

    if !path.is_file() {
        return Vec::new();
    }

    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };

    let Ok(parsed) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content)
    else {
        return Vec::new();
    };

    let mut result = Vec::new();
    for &allowed_key in ALLOWED_PROVIDER_KEYS {
        if let Some(serde_json::Value::String(val)) = parsed.get(allowed_key) {
            if !val.is_empty() {
                result.push((allowed_key.to_string(), val.clone()));
            }
        }
    }
    result
}

/// Seeds the runtime config file with default keys on first launch.
/// Uses atomic create-only (O_CREAT | O_EXCL) to avoid race conditions
/// when multiple app instances start simultaneously.
pub fn ensure_provider_config(app: &AppHandle) {
    let Some(path) = provider_config_path(app) else {
        return;
    };

    if let Some(parent) = path.parent() {
        if fs::create_dir_all(parent).is_err() {
            eprintln!("[abel] Failed to create provider config directory");
            return;
        }
    }

    // Atomic create-only: fails if file already exists (race-free).
    let mut opts = fs::OpenOptions::new();
    opts.write(true).create_new(true);

    // Restrict permissions to owner-only on unix (keys inside).
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }

    let file = match opts.open(&path) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => return,
        Err(e) => {
            eprintln!("[abel] Failed to create provider config: {e}");
            return;
        }
    };

    let config = serde_json::json!({
        "MINIMAX_API_KEY": DEFAULT_MINIMAX_KEY,
        "MOONSHOT_API_KEY": DEFAULT_MOONSHOT_KEY
    });

    if let Ok(content) = serde_json::to_string_pretty(&config) {
        let mut writer = std::io::BufWriter::new(file);
        if let Err(e) = writer.write_all(content.as_bytes()) {
            eprintln!("[abel] Failed to write provider config: {e}");
        }
    }
}

/// Returns the provider API keys to inject as env vars when spawning OpenCode.
/// Only returns keys the user hasn't already set in their own environment.
/// Reads from runtime config file first, falls back to compiled-in defaults.
pub fn provider_env_vars(app: &AppHandle) -> Vec<(String, String)> {
    let runtime = read_runtime_config(app);
    let mut vars = Vec::new();

    // Helper: get key from runtime config, or fall back to compiled-in default.
    let resolve = |key: &str, default: &str| -> Option<String> {
        // Skip if user already has this set in their own environment.
        if std::env::var(key).is_ok() {
            return None;
        }
        // Check runtime config override first.
        for (k, v) in &runtime {
            if k == key {
                return Some(v.clone());
            }
        }
        // Fall back to compiled-in default.
        if !default.is_empty() {
            return Some(default.to_string());
        }
        None
    };

    if let Some(val) = resolve("MINIMAX_API_KEY", DEFAULT_MINIMAX_KEY) {
        vars.push(("MINIMAX_API_KEY".to_string(), val));
    }

    if let Some(val) = resolve("MOONSHOT_API_KEY", DEFAULT_MOONSHOT_KEY) {
        vars.push(("MOONSHOT_API_KEY".to_string(), val));
    }

    // Additional allowed keys from runtime config (no compiled-in default).
    for &key in ALLOWED_PROVIDER_KEYS {
        if key == "MINIMAX_API_KEY" || key == "MOONSHOT_API_KEY" {
            continue;
        }
        if let Some(val) = resolve(key, "") {
            vars.push((key.to_string(), val));
        }
    }

    vars
}
