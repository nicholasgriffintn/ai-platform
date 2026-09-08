use std::path::PathBuf;

pub fn run_checked(command: &mut std::process::Command) -> Result<(), String> {
    let output = command.output().map_err(|cause| cause.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(())
}

pub async fn probe_output(program: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    tokio::time::timeout(
        std::time::Duration::from_secs(10),
        tokio::process::Command::new(resolve_program(program))
            .args(args)
            .env("NO_COLOR", "1")
            .stdin(std::process::Stdio::null())
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "The agent probe timed out."))?
}

pub fn resolve_program(program: &str) -> PathBuf {
    let mut paths: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|value| std::env::split_paths(&value).collect())
        .unwrap_or_default();
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        paths.push(home.join(".local/bin"));
        match program {
            "grok" => paths.push(home.join(".grok/bin")),
            "opencode" => paths.push(home.join(".opencode/bin")),
            _ => {}
        }
    }
    paths.push(PathBuf::from("/opt/homebrew/bin"));
    paths.push(PathBuf::from("/usr/local/bin"));
    paths
        .into_iter()
        .map(|path| path.join(program))
        .find(|path| path.is_file())
        .unwrap_or_else(|| PathBuf::from(program))
}
