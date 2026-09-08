use std::fs;
use std::path::PathBuf;
use std::process::Command;

use crate::programs::run_checked;
use crate::secrets;

const SERVICE_NAME: &str = "uk.co.nicholasgriffin.polychat.service";

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

pub fn dispatch(args: &[String]) -> Result<(), String> {
    let Some(command) = args.get(2).map(String::as_str) else {
        return Err("Usage: polychat service <install|status|uninstall>".to_string());
    };

    match command {
        "install" => install(),
        "status" => status(),
        "uninstall" => uninstall(),
        _ => Err("Usage: polychat service <install|status|uninstall>".to_string()),
    }
    .map(|_| {
        if command == "install" {
            println!("Service installed. Start Polychat at login to keep this machine online.");
        }
    })
}

fn install() -> Result<(), String> {
    ensure_supported()?;
    secrets::read(secrets::SESSION)
        .map_err(|cause| format!("Cannot access the session keychain: {cause}"))?
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            "Sign in to Polychat before installing the background service.".to_string()
        })?;
    let path = service_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|cause| cause.to_string())?;
    }
    fs::write(&path, service_definition()?).map_err(|cause| cause.to_string())?;
    match Platform::current() {
        Platform::Macos => {
            run_checked(Command::new("launchctl").args([
                "bootstrap",
                &format!("gui/{}", user_id()?),
                path.to_string_lossy().as_ref(),
            ]))?;
        }
        Platform::Linux => {
            run_checked(Command::new("systemctl").args(["--user", "daemon-reload"]))?;
            run_checked(Command::new("systemctl").args([
                "--user",
                "enable",
                "--now",
                SERVICE_NAME,
            ]))?;
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
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(())
}

fn uninstall() -> Result<(), String> {
    ensure_supported()?;
    match Platform::current() {
        Platform::Macos => {
            run_checked(
                Command::new("launchctl")
                    .args(["bootout", &format!("gui/{}/{}", user_id()?, SERVICE_NAME)]),
            )?;
        }
        Platform::Linux => {
            run_checked(Command::new("systemctl").args([
                "--user",
                "disable",
                "--now",
                SERVICE_NAME,
            ]))?;
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
        Platform::Unsupported => {
            Err("The Polychat background service supports macOS and Linux only.".to_string())
        }
    }
}

fn service_definition() -> Result<String, String> {
    let executable = std::env::current_exe().map_err(|cause| cause.to_string())?;
    let executable = executable.to_string_lossy();
    match Platform::current() {
        Platform::Macos => {
            let executable = crate::encoding::xml_text(&executable);
            Ok(format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\"><dict><key>Label</key><string>{SERVICE_NAME}</string><key>ProgramArguments</key><array><string>{executable}</string><string>--service</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>\n"
        ))
        }
        Platform::Linux => {
            let executable = crate::encoding::systemd_argument(&executable);
            Ok(format!(
            "[Unit]\nDescription=Polychat background service\n[Service]\nExecStart={executable} --service\nRestart=on-failure\n[Install]\nWantedBy=default.target\n"
        ))
        }
        Platform::Unsupported => {
            Err("The Polychat background service supports macOS and Linux only.".to_string())
        }
    }
}

fn user_id() -> Result<String, String> {
    let output = Command::new("id")
        .arg("-u")
        .output()
        .map_err(|cause| cause.to_string())?;
    if !output.status.success() {
        return Err("The current user id is unavailable.".to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
