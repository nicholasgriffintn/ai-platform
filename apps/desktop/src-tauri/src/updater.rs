use std::time::Duration;

use tauri::async_runtime::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Clone, Copy, PartialEq, Eq)]
enum Check {
    Scheduled,
    Requested,
}

#[derive(Default)]
struct UpdateChecks {
    declined: Mutex<Option<String>>,
}

pub fn start(app: &AppHandle, scheduled: bool) {
    app.manage(UpdateChecks::default());

    if !scheduled || cfg!(debug_assertions) {
        return;
    }

    let app = app.clone();

    tauri::async_runtime::spawn(async move {
        loop {
            run(&app, Check::Scheduled).await;
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

pub fn check_now(app: &AppHandle) {
    let app = app.clone();

    tauri::async_runtime::spawn(async move { run(&app, Check::Requested).await });
}

async fn run(app: &AppHandle, check: Check) {
    let Some(checks) = app.try_state::<UpdateChecks>() else {
        return;
    };
    let mut declined = checks.declined.lock().await;

    if let Err(error) = update(app, check, &mut declined).await {
        eprintln!("Polychat could not update itself: {error}");

        if check == Check::Requested {
            tell(app, "Polychat could not check for updates", error);
        }
    }
}

async fn update(
    app: &AppHandle,
    check: Check,
    declined: &mut Option<String>,
) -> Result<(), String> {
    let updater = app.updater().map_err(|cause| cause.to_string())?;

    let Some(update) = updater.check().await.map_err(|cause| cause.to_string())? else {
        if check == Check::Requested {
            tell(
                app,
                "Polychat is up to date",
                "You already have the latest version.".to_string(),
            );
        }

        return Ok(());
    };

    let version = update.version.clone();

    if check == Check::Scheduled && declined.as_deref() == Some(version.as_str()) {
        return Ok(());
    }

    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|cause| cause.to_string())?;

    if !ask_to_restart(app, &version).await? {
        *declined = Some(version);
        return Ok(());
    }

    update.install(bytes).map_err(|cause| cause.to_string())?;
    app.restart();
}

async fn ask_to_restart(app: &AppHandle, version: &str) -> Result<bool, String> {
    let prompt = app.clone();
    let message = format!(
        "Polychat {version} has landed. Restart now to settle in, or carry on and it will wait until you next open Polychat or check from the menu."
    );

    tauri::async_runtime::spawn_blocking(move || {
        prompt
            .dialog()
            .message(message)
            .title("A fresh Polychat")
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Restart".to_string(),
                "Later".to_string(),
            ))
            .blocking_show()
    })
    .await
    .map_err(|cause| cause.to_string())
}

fn tell(app: &AppHandle, title: &str, message: String) {
    app.dialog().message(message).title(title).show(|_| {});
}
