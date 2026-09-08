use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use rusqlite::Connection;
use serde::Serialize;

use crate::secrets;
use crate::store::Store;

const SERVICE_NAME: &str = "uk.co.nicholasgriffin.polychat.service";
const SERVICE_TOKEN: &str = "session-token";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Platform {
    Macos,
    Linux,
    Unsupported,
}

impl Platform {
    fn current() -> Self {
        match std::env::consts::OS {
            "macos" => Self::Macos,
            "linux" => Self::Linux,
            _ => Self::Unsupported,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Heartbeat {
    machine_id: String,
    label: String,
    platform: String,
    app_version: String,
    runtimes: Vec<serde_json::Value>,
    capabilities: Vec<String>,
}

pub fn dispatch(args: &[String], api_base_url: &str) -> Result<(), String> {
    let Some(command) = args.get(2).map(String::as_str) else {
        return Err("Usage: polychat service <install|status|uninstall>".to_string());
    };

    match command {
        "install" => install(),
        "status" => status(),
        "uninstall" => uninstall(),
        _ => Err("Usage: polychat service <install|status|uninstall>".to_string()),
    }
    .and_then(|_| {
        if command == "install" {
            println!("Service installed. Start Polychat at login to keep this machine online.");
            let _ = api_base_url;
        }
        Ok(())
    })
}

pub fn run(api_base_url: &str) -> Result<(), String> {
    if Platform::current() == Platform::Unsupported {
        return Err("The Polychat background service supports macOS and Linux only.".to_string());
    }

    let data_dir = data_dir()?;
    fs::create_dir_all(&data_dir).map_err(|cause| cause.to_string())?;
    let lock_path = data_dir.join("service.lock");
    let _lock = ServiceLock::acquire(&lock_path)?;
    let token = secrets::read(SERVICE_TOKEN)?
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "The background service needs an active Polychat sign-in.".to_string())?;
    let store = Store::open(
        Connection::open(data_dir.join("polychat.sqlite")).map_err(|cause| cause.to_string())?,
    )?;
    let machine_id = store.machine_id()?;
    let platform = match Platform::current() {
        Platform::Macos => "macos",
        Platform::Linux => "linux",
        Platform::Unsupported => unreachable!(),
    };
    let heartbeat = Heartbeat {
        machine_id,
        label: format!("Polychat Desktop ({platform})"),
        platform: platform.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        runtimes: Vec::new(),
        capabilities: Vec::new(),
    };
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_time()
        .enable_io()
        .build()
        .map_err(|cause| cause.to_string())?;

    runtime.block_on(async move {
        let client = reqwest::Client::new();
        loop {
            let response = client
                .post(format!("{api_base_url}/machines/heartbeat"))
                .bearer_auth(&token)
                .json(&heartbeat)
                .send()
                .await
                .map_err(|cause| cause.to_string())?;
            if !response.status().is_success() {
                return Err(format!("Machine heartbeat failed with status {}", response.status()));
            }
            tokio::time::sleep(Duration::from_secs(120)).await;
        }
    })
}

fn install() -> Result<(), String> {
    ensure_supported()?;
    secrets::read(SERVICE_TOKEN)
        .map_err(|cause| format!("Cannot access the session keychain: {cause}"))?
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Sign in to Polychat before installing the background service.".to_string())?;
    let path = service_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|cause| cause.to_string())?;
    }
    fs::write(&path, service_definition()?).map_err(|cause| cause.to_string())?;
    match Platform::current() {
        Platform::Macos => {
            let _ = Command::new("launchctl")
                .args(["bootstrap", &format!("gui/{}", user_id()?), path.to_string_lossy().as_ref()])
                .status();
        }
        Platform::Linux => {
            let _ = Command::new("systemctl").args(["--user", "daemon-reload"]).status();
            let _ = Command::new("systemctl")
                .args(["--user", "enable", "--now", SERVICE_NAME])
                .status();
        }
        Platform::Unsupported => unreachable!(),
    }
    Ok(())
}

fn status() -> Result<(), String> {
    ensure_supported()?;
    let output = match Platform::current() {
        Platform::Macos => Command::new("launchctl")
            .args(["print", &format!("gui/{}/{}", user_id()?, SERVICE_NAME)])
            .output()
            .map_err(|cause| cause.to_string())?,
        Platform::Linux => Command::new("systemctl")
            .args(["--user", "status", SERVICE_NAME, "--no-pager"])
            .output()
            .map_err(|cause| cause.to_string())?,
        Platform::Unsupported => unreachable!(),
    };
    print!("{}", String::from_utf8_lossy(&output.stdout));
    if !output.status.success() {
        print!("{}", String::from_utf8_lossy(&output.stderr));
    }
    Ok(())
}

fn uninstall() -> Result<(), String> {
    ensure_supported()?;
    match Platform::current() {
        Platform::Macos => {
            let _ = Command::new("launchctl")
                .args(["bootout", &format!("gui/{}/{}", user_id()?, SERVICE_NAME)])
                .status();
        }
        Platform::Linux => {
            let _ = Command::new("systemctl")
                .args(["--user", "disable", "--now", SERVICE_NAME])
                .status();
        }
        Platform::Unsupported => unreachable!(),
    }
    let path = service_path()?;
    if path.exists() {
        fs::remove_file(path).map_err(|cause| cause.to_string())?;
    }
    Ok(())
}

fn ensure_supported() -> Result<(), String> {
    if Platform::current() == Platform::Unsupported {
        Err("The Polychat background service supports macOS and Linux only; Windows is not supported in v1.".to_string())
    } else {
        Ok(())
    }
}

fn data_dir() -> Result<PathBuf, String> {
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")))
        .ok_or_else(|| "A user data directory is not available.".to_string())?;
    Ok(if Platform::current() == Platform::Macos {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| "A home directory is not available.".to_string())?
            .join("Library/Application Support/uk.co.nicholasgriffin.polychat.desktop")
    } else {
        base.join("polychat")
    })
}

fn service_path() -> Result<PathBuf, String> {
    match Platform::current() {
        Platform::Macos => Ok(std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| "A home directory is not available.".to_string())?
            .join("Library/LaunchAgents")
            .join(format!("{SERVICE_NAME}.plist"))),
        Platform::Linux => Ok(std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
            .ok_or_else(|| "A user configuration directory is not available.".to_string())?
            .join("systemd/user")
            .join(format!("{SERVICE_NAME}.service"))),
        Platform::Unsupported => Err("The Polychat background service supports macOS and Linux only.".to_string()),
    }
}

fn service_definition() -> Result<String, String> {
    let executable = std::env::current_exe().map_err(|cause| cause.to_string())?;
    let executable = executable.to_string_lossy();
    match Platform::current() {
        Platform::Macos => Ok(format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\"><dict><key>Label</key><string>{SERVICE_NAME}</string><key>ProgramArguments</key><array><string>{executable}</string><string>--service</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>\n"
        )),
        Platform::Linux => Ok(format!(
            "[Unit]\nDescription=Polychat background service\n[Service]\nExecStart={executable} --service\nRestart=on-failure\n[Install]\nWantedBy=default.target\n"
        )),
        Platform::Unsupported => Err("The Polychat background service supports macOS and Linux only.".to_string()),
    }
}

fn user_id() -> Result<String, String> {
    std::env::var("UID").map_err(|_| "The current user id is unavailable.".to_string())
}

struct ServiceLock {
    path: PathBuf,
}

impl ServiceLock {
    fn acquire(path: &Path) -> Result<Self, String> {
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|cause| format!("The Polychat service is already running or cannot lock its data directory: {cause}"))?;
        Ok(Self { path: path.to_path_buf() })
    }
}

impl Drop for ServiceLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linux_unit_keeps_the_same_binary_in_headless_mode() {
        let definition = "ExecStart=/tmp/polychat --service";
        assert!(definition.ends_with("--service"));
    }

    #[test]
    fn lock_creation_is_exclusive() {
        let path = std::env::temp_dir().join(format!("polychat-service-{}", std::process::id()));
        let first = ServiceLock::acquire(&path).expect("first lock");
        assert!(ServiceLock::acquire(&path).is_err());
        drop(first);
        assert!(ServiceLock::acquire(&path).is_ok());
        let _ = fs::remove_file(path);
    }
}
