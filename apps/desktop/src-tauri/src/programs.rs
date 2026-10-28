use std::path::PathBuf;

pub fn run_checked(command: &mut std::process::Command) -> Result<(), String> {
    let output = command.output().map_err(|cause| cause.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(())
}

const HOST_SESSION_VARIABLES: &[&str] = &[
    "CLAUDECODE",
    "CLAUDE_CODE_ENTRYPOINT",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_CODE_CHILD_SESSION",
    "CLAUDE_CODE_HOST_SESSION_ID",
    "CLAUDE_CODE_MESSAGING_SOCKET",
    "CLAUDE_CODE_MESSAGING_TOKEN",
    "CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH",
    "CLAUDE_AGENT_SDK_VERSION",
    "CLAUDE_AGENT_SDK_MCP_NO_PREFIX",
];

const METERED_KEY_VARIABLES: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "OPENAI_API_KEY",
    "CODEX_API_KEY",
];

pub fn scrub_agent_environment(
    command: &mut tokio::process::Command,
) -> &mut tokio::process::Command {
    for name in HOST_SESSION_VARIABLES.iter().chain(METERED_KEY_VARIABLES) {
        command.env_remove(name);
    }

    command.env("NO_COLOR", "1")
}

pub async fn probe_output(program: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    let mut command = tokio::process::Command::new(resolve_program(program));

    tokio::time::timeout(
        std::time::Duration::from_secs(10),
        scrub_agent_environment(&mut command)
            .args(args)
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
