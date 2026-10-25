use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use super::browsers::{detect_browsers, DetectedBrowser};
use super::collect::collect;
use super::control;
use super::digest::{ActivityCollection, SentActivity};
use super::mac;
use super::pause::{active_pause, PauseChoice};
use super::sampler::{ActivityPermissions, ActivityRuntime};
use super::settings::{ActivitySettings, NeverShareKey};
use crate::clock::{now_seconds, rfc3339};
use crate::store::Store;

const SENT_HISTORY: i64 = 7 * 24 * 3600;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityStatus {
    enabled: bool,
    sharing: Vec<&'static str>,
    paused: bool,
    paused_until: Option<String>,
    last_sent_at: Option<String>,
}

#[tauri::command]
pub fn read_activity_settings(store: State<'_, Store>) -> Result<ActivitySettings, String> {
    store.read_activity_settings()
}

#[tauri::command]
pub fn save_activity_settings(settings: ActivitySettings, app: AppHandle) -> Result<(), String> {
    control::save_settings(&app, &settings)
}

#[tauri::command]
pub fn read_activity_status(store: State<'_, Store>) -> Result<ActivityStatus, String> {
    let now = now_seconds();
    let settings = store.read_activity_settings()?;
    let pause = active_pause(&store.list_activity_pauses(now)?, now);

    Ok(ActivityStatus {
        enabled: settings.enabled,
        sharing: settings.sharing(),
        paused: pause.is_some(),
        paused_until: pause.and_then(|pause| pause.end).map(rfc3339),
        last_sent_at: store.last_activity_sent_at()?.map(rfc3339),
    })
}

#[tauri::command]
pub fn pause_activity(choice: PauseChoice, app: AppHandle) -> Result<(), String> {
    control::pause(&app, choice)
}

#[tauri::command]
pub fn resume_activity(app: AppHandle) -> Result<(), String> {
    control::resume(&app)
}

#[tauri::command]
pub async fn detect_activity_browsers() -> Result<Vec<DetectedBrowser>, String> {
    tauri::async_runtime::spawn_blocking(detect_browsers)
        .await
        .map_err(|cause| cause.to_string())
}

#[tauri::command]
pub async fn collect_activity(app: AppHandle) -> Result<Option<ActivityCollection>, String> {
    tauri::async_runtime::spawn_blocking(move || collect(&app.state::<Store>(), now_seconds()))
        .await
        .map_err(|cause| cause.to_string())?
}

#[tauri::command]
pub fn record_activity_sent(collection: ActivityCollection, app: AppHandle) -> Result<(), String> {
    let now = now_seconds();

    app.state::<Store>().record_activity_sent(
        now,
        &SentActivity {
            sent_at: rfc3339(now),
            collection,
        },
    )?;
    super::tray::refresh(&app);

    Ok(())
}

#[tauri::command]
pub fn list_activity_sent(store: State<'_, Store>) -> Result<Vec<SentActivity>, String> {
    store.list_activity_sent(now_seconds() - SENT_HISTORY)
}

#[tauri::command]
pub fn forget_activity_sent(app: AppHandle) -> Result<(), String> {
    control::forget(&app)
}

#[tauri::command]
pub fn never_share_activity(key: NeverShareKey, app: AppHandle) -> Result<(), String> {
    let mut settings = app.state::<Store>().read_activity_settings()?;

    settings.never_share_key(key);
    control::save_settings(&app, &settings)
}

#[tauri::command]
pub fn read_activity_permissions(runtime: State<'_, ActivityRuntime>) -> ActivityPermissions {
    runtime.permissions()
}

#[tauri::command]
pub fn open_activity_privacy_pane(pane: String) -> Result<(), String> {
    let url = mac::privacy_pane_url(&pane).ok_or_else(|| "Unknown privacy pane.".to_string())?;

    opener::open(url).map_err(|cause| cause.to_string())
}
