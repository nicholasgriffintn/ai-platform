use std::collections::BTreeSet;
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use super::mac::{self, ScriptOutcome};
use super::pause::active_pause;
use super::samples::{Sample, SampleKind, APPLE_MUSIC, SPOTIFY};
use super::settings::ActivitySettings;
use super::tray;
use crate::clock::now_seconds;
use crate::store::Store;

pub const SAMPLE_INTERVAL: Duration = Duration::from_secs(30);
const IDLE_LIMIT_SECONDS: u64 = 120;
const HOUR: i64 = 3600;

#[derive(Default)]
pub struct ActivityRuntime {
    refused: Mutex<BTreeSet<&'static str>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityPermissions {
    pub accessibility: bool,
    pub refused: Vec<String>,
}

impl ActivityRuntime {
    fn note(&self, target: &'static str, refused: bool) {
        if let Ok(mut set) = self.refused.lock() {
            if refused {
                set.insert(target);
            } else {
                set.remove(target);
            }
        }
    }

    pub fn permissions(&self) -> ActivityPermissions {
        ActivityPermissions {
            accessibility: mac::accessibility_trusted(),
            refused: self
                .refused
                .lock()
                .map(|set| set.iter().map(|target| target.to_string()).collect())
                .unwrap_or_default(),
        }
    }
}

fn sample(kind: SampleKind, key: &str, name: &str, detail: &str, now: i64) -> Sample {
    Sample {
        kind,
        key: key.to_string(),
        name: name.to_string(),
        detail: detail.to_string(),
        hour: now - now.rem_euclid(HOUR),
        seconds: SAMPLE_INTERVAL.as_secs() as i64,
    }
}

fn sample_front_app(
    store: &Store,
    runtime: &ActivityRuntime,
    settings: &ActivitySettings,
    now: i64,
) {
    if mac::idle_seconds().is_some_and(|idle| idle > IDLE_LIMIT_SECONDS) {
        return;
    }

    let Some(app) = mac::front_app() else {
        return;
    };

    if settings
        .never_share
        .apps
        .contains(&app.bundle.to_lowercase())
    {
        return;
    }

    let title = if settings.apps.window_titles {
        match mac::front_window_title() {
            ScriptOutcome::Value(title) => {
                runtime.note("windowTitles", false);
                title
            }
            ScriptOutcome::Nothing => String::new(),
            ScriptOutcome::Refused => {
                runtime.note("windowTitles", true);
                String::new()
            }
        }
    } else {
        String::new()
    };

    let _ = store.add_activity_sample(&sample(
        SampleKind::App,
        &app.bundle,
        &app.name,
        &title,
        now,
    ));
}

fn sample_player(store: &Store, runtime: &ActivityRuntime, bundle: &'static str, now: i64) {
    match mac::now_playing(bundle) {
        ScriptOutcome::Value(playing) if !playing.track.is_empty() => {
            runtime.note(bundle, false);
            let _ = store.add_activity_sample(&sample(
                SampleKind::Track,
                bundle,
                &playing.track,
                &playing.artist,
                now,
            ));
        }
        ScriptOutcome::Refused => runtime.note(bundle, true),
        _ => {}
    }
}

fn tick(app: &AppHandle) {
    let store = app.state::<Store>();
    let runtime = app.state::<ActivityRuntime>();
    let now = now_seconds();

    tray::refresh(app);

    let Ok(settings) = store.read_activity_settings() else {
        return;
    };
    let paused = store
        .list_activity_pauses(now)
        .map(|pauses| active_pause(&pauses, now).is_some())
        .unwrap_or(true);

    if !settings.enabled || paused {
        return;
    }

    if settings.apps.enabled {
        sample_front_app(&store, &runtime, &settings, now);
    }

    if settings.music.apple_music {
        sample_player(&store, &runtime, APPLE_MUSIC, now);
    }

    if settings.music.spotify {
        sample_player(&store, &runtime, SPOTIFY, now);
    }

    let _ = store.prune_activity(now);
}

pub fn start(app: &AppHandle) {
    let app = app.clone();

    std::thread::spawn(move || loop {
        tick(&app);
        std::thread::sleep(SAMPLE_INTERVAL);
    });
}
