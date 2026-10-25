use tauri::{AppHandle, Emitter, Manager};

use super::mac;
use super::pause::{pause_end, PauseChoice};
use super::settings::ActivitySettings;
use super::tray;
use crate::clock::now_seconds;
use crate::store::Store;

pub const ACTIVITY_CHANGED_EVENT: &str = "polychat://activity-changed";

fn changed(app: &AppHandle) {
    tray::refresh(app);
    let _ = app.emit(ACTIVITY_CHANGED_EVENT, ());
}

pub fn pause(app: &AppHandle, choice: PauseChoice) -> Result<(), String> {
    let now = now_seconds();

    app.state::<Store>()
        .pause_activity(now, pause_end(choice, now, mac::local_offset_seconds()))?;
    changed(app);

    Ok(())
}

pub fn resume(app: &AppHandle) -> Result<(), String> {
    app.state::<Store>().resume_activity(now_seconds())?;
    changed(app);

    Ok(())
}

pub fn save_settings(app: &AppHandle, settings: &ActivitySettings) -> Result<(), String> {
    app.state::<Store>().save_activity_settings(settings)?;
    changed(app);

    Ok(())
}

pub fn forget(app: &AppHandle) -> Result<(), String> {
    app.state::<Store>().forget_activity()?;
    changed(app);

    Ok(())
}
