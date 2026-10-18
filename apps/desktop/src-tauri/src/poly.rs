use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub const OPEN_POLY_EVENT: &str = "polychat://open-poly";
pub const PERCH_LABEL: &str = "perch";
const MAIN_LABEL: &str = "main";
const TRAY_ID: &str = "poly";
const PERCH_WIDTH: f64 = 120.0;
const PERCH_HEIGHT: f64 = 132.0;
const PERCH_MARGIN: i32 = 24;
const MENU_ASK: &str = "poly-ask";
const MENU_PERCH: &str = "poly-perch";
const MENU_QUIT: &str = "poly-quit";

pub struct PolyTray {
    tray: TrayIcon<Wry>,
    perch_item: CheckMenuItem<Wry>,
}

pub fn quick_ask_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyJ)
}

pub fn tray_label(status: &str, needs_you: u32) -> (String, Option<String>) {
    let tooltip = format!("Poly: {status}");
    let title = (needs_you > 0).then(|| needs_you.to_string());

    (tooltip, title)
}

pub fn open_poly(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    let _ = app.emit_to(MAIN_LABEL, OPEN_POLY_EVENT, ());
}

fn perch_position(app: &AppHandle) -> Option<PhysicalPosition<i32>> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let size = monitor.size();
    let origin = monitor.position();
    let width = (PERCH_WIDTH * scale) as i32;
    let height = (PERCH_HEIGHT * scale) as i32;

    Some(PhysicalPosition::new(
        origin.x + size.width as i32 - width - PERCH_MARGIN,
        origin.y + size.height as i32 - height - PERCH_MARGIN * 3,
    ))
}

pub fn set_perch(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(PERCH_LABEL) {
        if visible {
            window.show()?;
        } else {
            window.close()?;
        }
    } else if visible {
        let window =
            WebviewWindowBuilder::new(app, PERCH_LABEL, WebviewUrl::App("index.html".into()))
                .title("Poly")
                .inner_size(PERCH_WIDTH, PERCH_HEIGHT)
                .resizable(false)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .focused(false)
                .build()?;

        if let Some(position) = perch_position(app) {
            window.set_position(position)?;
        }
    }

    if let Some(tray) = app.try_state::<PolyTray>() {
        tray.perch_item.set_checked(visible)?;
    }

    Ok(())
}

pub fn install_tray(app: &AppHandle) -> tauri::Result<()> {
    let ask = MenuItem::with_id(app, MENU_ASK, "Ask Poly", true, Some("CmdOrCtrl+Shift+J"))?;
    let perch = CheckMenuItem::with_id(
        app,
        MENU_PERCH,
        "Keep Poly on the desktop",
        true,
        false,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "Quit Polychat", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&ask, &perch, &separator, &quit])?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("Poly: Ready when you are")
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_ASK => open_poly(app),
            MENU_PERCH => {
                let showing = app.get_webview_window(PERCH_LABEL).is_some();
                let _ = set_perch(app, !showing);
            }
            MENU_QUIT => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let tray = builder.build(app)?;

    app.manage(PolyTray {
        tray,
        perch_item: perch,
    });

    Ok(())
}

pub fn register_quick_ask(app: &AppHandle) -> Result<(), tauri_plugin_global_shortcut::Error> {
    app.global_shortcut()
        .on_shortcut(quick_ask_shortcut(), |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                open_poly(app);
            }
        })
}

pub fn show_presence(app: &AppHandle, status: &str, needs_you: u32) -> tauri::Result<()> {
    let Some(state) = app.try_state::<PolyTray>() else {
        return Ok(());
    };
    let (tooltip, title) = tray_label(status, needs_you);

    state.tray.set_tooltip(Some(tooltip))?;
    state.tray.set_title(title)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_what_needs_you_in_the_tray_title_and_stays_quiet_otherwise() {
        assert_eq!(
            tray_label("2 things need you", 2),
            ("Poly: 2 things need you".to_string(), Some("2".to_string()))
        );
        assert_eq!(
            tray_label("Ready when you are", 0),
            ("Poly: Ready when you are".to_string(), None)
        );
    }
}
