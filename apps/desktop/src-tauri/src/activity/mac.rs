use std::process::Command;

pub const AUTOMATION_REFUSED: &str = "-1743";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FrontApp {
    pub name: String,
    pub bundle: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NowPlaying {
    pub track: String,
    pub artist: String,
}

pub enum ScriptOutcome<T> {
    Value(T),
    Nothing,
    Refused,
}

fn run(program: &str, arguments: &[&str]) -> Option<String> {
    let output = Command::new(program).args(arguments).output().ok()?;

    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn parse_lsappinfo(output: &str) -> Option<FrontApp> {
    let value = |key: &str| {
        output.lines().find_map(|line| {
            let (name, value) = line.trim().split_once('=')?;

            (name.trim_matches('"') == key).then(|| value.trim().trim_matches('"').to_string())
        })
    };

    Some(FrontApp {
        name: value("LSDisplayName").filter(|name| !name.is_empty())?,
        bundle: value("CFBundleIdentifier").unwrap_or_default(),
    })
}

pub fn parse_idle_nanoseconds(output: &str) -> Option<u64> {
    output.lines().find_map(|line| {
        let (_, value) = line.split_once("\"HIDIdleTime\" =")?;

        value.trim().parse().ok()
    })
}

pub fn parse_local_offset(output: &str) -> Option<i64> {
    let text = output.trim();
    let (sign, digits) = match text.split_at_checked(1)? {
        ("+", digits) => (1, digits),
        ("-", digits) => (-1, digits),
        _ => return None,
    };
    let (hours, minutes) = digits.split_at_checked(2)?;

    Some(sign * (hours.parse::<i64>().ok()? * 3600 + minutes.parse::<i64>().ok()? * 60))
}

pub fn front_app() -> Option<FrontApp> {
    let asn = run("lsappinfo", &["front"])?;
    let asn = asn.trim();

    if asn.is_empty() {
        return None;
    }

    parse_lsappinfo(&run(
        "lsappinfo",
        &["info", "-only", "name", "-only", "bundleid", asn],
    )?)
}

pub fn idle_seconds() -> Option<u64> {
    parse_idle_nanoseconds(&run("ioreg", &["-c", "IOHIDSystem", "-d", "4"])?)
        .map(|nanoseconds| nanoseconds / 1_000_000_000)
}

pub fn local_offset_seconds() -> i64 {
    run("date", &["+%z"])
        .and_then(|output| parse_local_offset(&output))
        .unwrap_or_default()
}

pub fn computer_name() -> Option<String> {
    run("scutil", &["--get", "ComputerName"])
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
}

pub fn is_running(bundle: &str) -> bool {
    run("lsappinfo", &["find", &format!("bundleid={bundle}")])
        .is_some_and(|output| !output.trim().is_empty())
}

fn script(source: &str) -> ScriptOutcome<String> {
    let Ok(output) = Command::new("osascript").args(["-e", source]).output() else {
        return ScriptOutcome::Nothing;
    };

    if !output.status.success() {
        return if String::from_utf8_lossy(&output.stderr).contains(AUTOMATION_REFUSED) {
            ScriptOutcome::Refused
        } else {
            ScriptOutcome::Nothing
        };
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if text.is_empty() {
        ScriptOutcome::Nothing
    } else {
        ScriptOutcome::Value(text)
    }
}

pub fn front_window_title() -> ScriptOutcome<String> {
    script(
        "tell application \"System Events\"
            set frontProcess to first application process whose frontmost is true
            try
                return name of front window of frontProcess
            on error
                return \"\"
            end try
        end tell",
    )
}

pub fn now_playing(bundle: &str) -> ScriptOutcome<NowPlaying> {
    if !is_running(bundle) {
        return ScriptOutcome::Nothing;
    }

    let source = format!(
        "tell application id \"{bundle}\"
            if player state is playing then
                return (name of current track) & tab & (artist of current track)
            end if
        end tell
        return \"\""
    );

    match script(&source) {
        ScriptOutcome::Value(text) => {
            let (track, artist) = text.split_once('\t').unwrap_or((text.as_str(), ""));

            ScriptOutcome::Value(NowPlaying {
                track: track.trim().to_string(),
                artist: artist.trim().to_string(),
            })
        }
        ScriptOutcome::Nothing => ScriptOutcome::Nothing,
        ScriptOutcome::Refused => ScriptOutcome::Refused,
    }
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[cfg(target_os = "macos")]
pub fn accessibility_trusted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

#[cfg(not(target_os = "macos"))]
pub fn accessibility_trusted() -> bool {
    false
}

pub fn privacy_pane_url(pane: &str) -> Option<&'static str> {
    match pane {
        "accessibility" => {
            Some("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        }
        "automation" => {
            Some("x-apple.systempreferences:com.apple.preference.security?Privacy_Automation")
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_front_app_from_lsappinfo() {
        let output = "\"LSDisplayName\"=\"Helium\"\n\"CFBundleIdentifier\"=\"net.imput.helium\"\n";

        assert_eq!(
            parse_lsappinfo(output),
            Some(FrontApp {
                name: "Helium".to_string(),
                bundle: "net.imput.helium".to_string()
            })
        );
        assert_eq!(parse_lsappinfo(""), None);
    }

    #[test]
    fn reads_idle_time_and_the_local_offset() {
        assert_eq!(
            parse_idle_nanoseconds("    | |     \"HIDIdleTime\" = 134742958\n"),
            Some(134_742_958)
        );
        assert_eq!(parse_local_offset("+0100\n"), Some(3600));
        assert_eq!(parse_local_offset("-0530"), Some(-(5 * 3600 + 30 * 60)));
        assert_eq!(parse_local_offset("BST"), None);
    }
}
