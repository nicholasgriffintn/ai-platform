use tauri::menu::MenuItem;
use tauri::{AppHandle, Emitter, Manager, Wry};

use super::control;
use super::mac;
use super::pause::{active_pause, PauseChoice, PauseRange};
use super::settings::ActivitySettings;
use crate::clock::{local_clock_time, now_seconds};
use crate::links::DEEP_LINK_EVENT;
use crate::poly;
use crate::store::Store;

const MENU_PAUSE_HOUR: &str = "activity-pause-hour";
const MENU_PAUSE_TOMORROW: &str = "activity-pause-tomorrow";
const MENU_PAUSE_OPEN: &str = "activity-pause-open";
const MENU_RESUME: &str = "activity-resume";
const MENU_REVIEW: &str = "activity-review";
const MENU_SETTINGS: &str = "activity-settings";
const SETTINGS_LINK: &str = "polychat://profile?tab=activity";
const REVIEW_LINK: &str = "polychat://profile?tab=activity&section=sent";

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum ActivityMenu {
    #[default]
    Off,
    Sharing(String),
    Paused(String),
}

impl ActivityMenu {
    pub fn tooltip_note(&self) -> Option<&str> {
        match self {
            ActivityMenu::Paused(status) => Some(status),
            _ => None,
        }
    }
}

fn describe_sources(sources: &[&str]) -> String {
    let names: Vec<&str> = sources
        .iter()
        .map(|source| match *source {
            "agents" => "coding agents",
            other => other,
        })
        .collect();

    match names.as_slice() {
        [] => String::new(),
        [only] => only.to_string(),
        [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
    }
}

pub fn describe(
    settings: &ActivitySettings,
    pauses: &[PauseRange],
    now: i64,
    offset_seconds: i64,
) -> ActivityMenu {
    if !settings.enabled {
        return ActivityMenu::Off;
    }

    if let Some(pause) = active_pause(pauses, now) {
        return ActivityMenu::Paused(match pause.end {
            Some(end) => format!(
                "Activity paused until {}",
                local_clock_time(end, offset_seconds)
            ),
            None => "Activity paused until you resume".to_string(),
        });
    }

    let sharing = settings.sharing();

    ActivityMenu::Sharing(if sharing.is_empty() {
        "Activity sharing has nothing chosen".to_string()
    } else {
        format!("Sharing {}", describe_sources(&sharing))
    })
}

pub fn menu_items(app: &AppHandle, menu: &ActivityMenu) -> tauri::Result<Vec<MenuItem<Wry>>> {
    let item = |id: &str, label: &str| MenuItem::with_id(app, id, label, true, None::<&str>);
    let status = match menu {
        ActivityMenu::Off => "Activity sharing is off",
        ActivityMenu::Sharing(status) | ActivityMenu::Paused(status) => status,
    };
    let mut items = vec![MenuItem::with_id(
        app,
        "activity-status",
        status,
        false,
        None::<&str>,
    )?];

    match menu {
        ActivityMenu::Off => {}
        ActivityMenu::Sharing(_) => {
            items.push(item(MENU_PAUSE_HOUR, "Pause for an hour")?);
            items.push(item(MENU_PAUSE_TOMORROW, "Pause until tomorrow")?);
            items.push(item(MENU_PAUSE_OPEN, "Pause until I resume")?);
            items.push(item(MENU_REVIEW, "Review what was sent…")?);
        }
        ActivityMenu::Paused(_) => {
            items.push(item(MENU_RESUME, "Resume sharing")?);
            items.push(item(MENU_REVIEW, "Review what was sent…")?);
        }
    }

    items.push(item(MENU_SETTINGS, "Activity settings…")?);

    Ok(items)
}

fn open_link(app: &AppHandle, link: &str) {
    poly::show_main(app);
    let _ = app.emit(DEEP_LINK_EVENT, link.to_string());
}

pub fn handle_menu_event(app: &AppHandle, id: &str) {
    let outcome = match id {
        MENU_PAUSE_HOUR => control::pause(app, PauseChoice::Hour),
        MENU_PAUSE_TOMORROW => control::pause(app, PauseChoice::Tomorrow),
        MENU_PAUSE_OPEN => control::pause(app, PauseChoice::UntilResumed),
        MENU_RESUME => control::resume(app),
        MENU_REVIEW => {
            open_link(app, REVIEW_LINK);
            Ok(())
        }
        MENU_SETTINGS => {
            open_link(app, SETTINGS_LINK);
            Ok(())
        }
        _ => Ok(()),
    };

    if let Err(error) = outcome {
        eprintln!("Activity sharing could not change: {error}");
    }
}

pub fn refresh(app: &AppHandle) {
    let Some(store) = app.try_state::<Store>() else {
        return;
    };
    let now = now_seconds();
    let (Ok(settings), Ok(pauses)) = (
        store.read_activity_settings(),
        store.list_activity_pauses(now),
    ) else {
        return;
    };

    poly::show_activity(
        app,
        describe(&settings, &pauses, now, mac::local_offset_seconds()),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::activity::settings::{AgentSettings, MusicSettings};

    fn sharing() -> ActivitySettings {
        ActivitySettings {
            enabled: true,
            agents: AgentSettings {
                claude_code: true,
                ..AgentSettings::default()
            },
            music: MusicSettings {
                apple_music: true,
                spotify: false,
            },
            ..ActivitySettings::default()
        }
    }

    #[test]
    fn names_what_is_being_shared() {
        assert_eq!(
            describe(&sharing(), &[], 0, 0),
            ActivityMenu::Sharing("Sharing coding agents and music".to_string())
        );
        assert_eq!(
            describe(&ActivitySettings::default(), &[], 0, 0),
            ActivityMenu::Off
        );
    }

    #[test]
    fn says_when_a_pause_ends_in_local_time() {
        let pauses = [PauseRange {
            start: 0,
            end: Some(14 * 3600 + 30 * 60),
        }];

        assert_eq!(
            describe(&sharing(), &pauses, 60, 3600),
            ActivityMenu::Paused("Activity paused until 15:30".to_string())
        );
        assert_eq!(
            describe(
                &sharing(),
                &[PauseRange {
                    start: 0,
                    end: None
                }],
                60,
                0
            ),
            ActivityMenu::Paused("Activity paused until you resume".to_string())
        );
    }
}
