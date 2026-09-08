use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentDriver {
    ClaudeCode,
    Codex,
    Cursor,
    Grok,
    #[serde(rename = "opencode")]
    OpenCode,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionMode {
    Supervised,
    AutoAcceptEdits,
    Auto,
    FullAccess,
}

#[derive(Clone, Debug, Deserialize)]
pub struct RunParams {
    pub prompt: String,
    pub session: Option<String>,
    pub permission_mode: PermissionMode,
    pub model: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentProgram {
    pub driver: AgentDriver,
    pub program: &'static str,
    pub version_args: &'static [&'static str],
    pub readiness_args: Option<&'static [&'static str]>,
    pub min_version: &'static str,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryGrant {
    pub id: String,
    pub path: PathBuf,
    pub label: String,
    pub approved_at: String,
    pub last_used_at: Option<String>,
    pub is_git_repo: bool,
}

#[derive(Default)]
pub struct DirectoryGrants {
    grants: Mutex<HashMap<String, DirectoryGrant>>,
}

impl DirectoryGrants {
    pub fn from_grants(grants: Vec<DirectoryGrant>) -> Self {
        Self {
            grants: Mutex::new(
                grants
                    .into_iter()
                    .map(|grant| (grant.id.clone(), grant))
                    .collect(),
            ),
        }
    }

    pub fn add(&self, path: &Path) -> Result<DirectoryGrant, ProcessRefusal> {
        let path = canonical_directory(path)?;
        let id = format!(
            "directory-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| ProcessRefusal::InvalidDirectory)?
                .as_nanos()
        );
        let label = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Workspace")
            .to_string();
        let is_git_repo = git_head(&path).is_ok();
        let grant = DirectoryGrant {
            id: id.clone(),
            path,
            label,
            approved_at: id.trim_start_matches("directory-").to_string(),
            last_used_at: None,
            is_git_repo,
        };

        self.grants
            .lock()
            .map_err(|_| ProcessRefusal::InvalidDirectory)?
            .insert(id, grant.clone());

        Ok(grant)
    }

    pub fn get(&self, id: &str) -> Result<DirectoryGrant, ProcessRefusal> {
        self.grants
            .lock()
            .map_err(|_| ProcessRefusal::InvalidDirectory)?
            .get(id)
            .cloned()
            .ok_or(ProcessRefusal::DirectoryOutsideGrant)
    }

    pub fn remove(&self, id: &str) -> Result<(), ProcessRefusal> {
        self.grants
            .lock()
            .map_err(|_| ProcessRefusal::InvalidDirectory)?
            .remove(id)
            .map(|_| ())
            .ok_or(ProcessRefusal::DirectoryOutsideGrant)
    }

    pub fn touch(&self, id: &str, at: String) -> Result<(), ProcessRefusal> {
        let mut grants = self
            .grants
            .lock()
            .map_err(|_| ProcessRefusal::InvalidDirectory)?;
        let grant = grants
            .get_mut(id)
            .ok_or(ProcessRefusal::DirectoryOutsideGrant)?;
        grant.last_used_at = Some(at);
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessRunRequest {
    pub driver: AgentDriver,
    pub directory_id: String,
    pub prompt: String,
    pub session: Option<String>,
    pub permission_mode: PermissionMode,
    pub model: Option<String>,
    pub acknowledge_dirty: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "state",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum AgentToolState {
    Missing {
        checked_at: String,
    },
    Present {
        checked_at: String,
        version: Option<String>,
    },
    SignedOut {
        checked_at: String,
        version: Option<String>,
    },
    Ready {
        checked_at: String,
        version: String,
    },
    UnsupportedVersion {
        checked_at: String,
        version: String,
        minimum: String,
    },
}

#[derive(Debug, Eq, PartialEq)]
pub enum ProcessRefusal {
    InvalidPrompt,
    UnsupportedPermissionMode,
    InvalidDirectory,
    DirectoryOutsideGrant,
    UnsafeDirectory,
    DirtyTree,
    MissingHead,
    AlreadyRunning,
    NotInstalled,
    SessionsUnsupported,
}

pub fn session_argv(driver: AgentDriver) -> Option<Vec<String>> {
    match driver {
        AgentDriver::Codex => Some(vec!["app-server".to_string()]),
        _ => None,
    }
}

pub fn supports_sessions(driver: AgentDriver) -> bool {
    session_argv(driver).is_some()
}

pub fn program_for(driver: AgentDriver) -> AgentProgram {
    match driver {
        AgentDriver::ClaudeCode => AgentProgram {
            driver,
            program: "claude",
            version_args: &["--version"],
            readiness_args: Some(&["auth", "status"]),
            min_version: "1.0.0",
        },
        AgentDriver::Codex => AgentProgram {
            driver,
            program: "codex",
            version_args: &["--version"],
            readiness_args: Some(&["login", "status"]),
            min_version: "0.153.4",
        },
        AgentDriver::Cursor => AgentProgram {
            driver,
            program: "cursor-agent",
            version_args: &["--version"],
            readiness_args: Some(&["status"]),
            min_version: "1.0.0",
        },
        AgentDriver::Grok => AgentProgram {
            driver,
            program: "grok",
            version_args: &["--version"],
            readiness_args: Some(&["models"]),
            min_version: "0.1.42",
        },
        AgentDriver::OpenCode => AgentProgram {
            driver,
            program: "opencode",
            version_args: &["--version"],
            readiness_args: Some(&["auth", "list"]),
            min_version: "1.0.0",
        },
    }
}

pub async fn probe(driver: AgentDriver, checked_at: String) -> AgentToolState {
    let program = program_for(driver);
    let output = match crate::programs::probe_output(program.program, program.version_args).await {
        Ok(output) => output,
        Err(cause) if cause.kind() == std::io::ErrorKind::NotFound => {
            return AgentToolState::Missing { checked_at }
        }
        Err(_) => {
            return AgentToolState::Present {
                checked_at,
                version: None,
            }
        }
    };

    let version_output = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let version = version_output
        .split_whitespace()
        .find(|part| {
            part.chars()
                .next()
                .is_some_and(|value| value.is_ascii_digit())
        })
        .unwrap_or_default()
        .to_string();

    if !output.status.success() {
        if !version.is_empty() {
            return AgentToolState::Present {
                checked_at,
                version: Some(version),
            };
        }

        return AgentToolState::SignedOut {
            checked_at,
            version: (!version_output.is_empty()).then_some(version_output),
        };
    }

    if version.is_empty() {
        return AgentToolState::SignedOut {
            checked_at,
            version: (!version_output.is_empty()).then_some(version_output),
        };
    }

    if compare_versions(&version, program.min_version).is_lt() {
        return AgentToolState::UnsupportedVersion {
            checked_at,
            version,
            minimum: program.min_version.to_string(),
        };
    }

    if let Some(readiness_args) = program.readiness_args {
        let readiness = crate::programs::probe_output(program.program, readiness_args).await;
        if readiness.is_err()
            || !readiness.is_ok_and(|output| {
                output.status.success()
                    && (driver != AgentDriver::OpenCode
                        || opencode_has_credentials(&String::from_utf8_lossy(&output.stdout)))
            })
        {
            return AgentToolState::SignedOut {
                checked_at,
                version: Some(version),
            };
        }
    }

    AgentToolState::Ready {
        checked_at,
        version,
    }
}

fn opencode_has_credentials(output: &str) -> bool {
    output
        .split_whitespace()
        .collect::<Vec<_>>()
        .windows(2)
        .any(|words| {
            words[0].parse::<usize>().is_ok_and(|count| count > 0)
                && matches!(words[1], "credentials" | "environment")
        })
}

fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
    let left_parts = left.split('.').map(|part| part.parse::<u64>().unwrap_or(0));
    let right_parts = right
        .split('.')
        .map(|part| part.parse::<u64>().unwrap_or(0));

    left_parts
        .zip(right_parts)
        .map(|(left, right)| left.cmp(&right))
        .find(|ordering| !ordering.is_eq())
        .unwrap_or_else(|| left.split('.').count().cmp(&right.split('.').count()))
}

fn permission_argument(mode: PermissionMode) -> &'static str {
    match mode {
        PermissionMode::Supervised => "default",
        PermissionMode::AutoAcceptEdits => "acceptEdits",
        PermissionMode::Auto => "auto",
        PermissionMode::FullAccess => "bypassPermissions",
    }
}

pub fn build_argv(driver: AgentDriver, params: &RunParams) -> Result<Vec<String>, ProcessRefusal> {
    if params.prompt.trim().is_empty() {
        return Err(ProcessRefusal::InvalidPrompt);
    }

    let mut argv = match driver {
        AgentDriver::Codex => vec![
            "exec".to_string(),
            "--json".to_string(),
            "--sandbox".to_string(),
            codex_sandbox_argument(params.permission_mode).to_string(),
        ],
        AgentDriver::Cursor => {
            if !matches!(
                params.permission_mode,
                PermissionMode::Supervised | PermissionMode::FullAccess
            ) {
                return Err(ProcessRefusal::UnsupportedPermissionMode);
            }

            let mut argv = vec![
                "-p".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
            ];
            if params.permission_mode == PermissionMode::FullAccess {
                argv.push("--force".to_string());
            }
            argv
        }
        AgentDriver::Grok => {
            if !matches!(
                params.permission_mode,
                PermissionMode::Supervised | PermissionMode::Auto
            ) {
                return Err(ProcessRefusal::UnsupportedPermissionMode);
            }
            let mut argv = vec![
                "--no-auto-update".to_string(),
                "-p".to_string(),
                params.prompt.clone(),
                "--output-format".to_string(),
                "json".to_string(),
            ];
            if params.permission_mode == PermissionMode::Auto {
                argv.push("--always-approve".to_string());
            }
            argv
        }
        AgentDriver::OpenCode => {
            if !matches!(
                params.permission_mode,
                PermissionMode::Supervised | PermissionMode::Auto
            ) {
                return Err(ProcessRefusal::UnsupportedPermissionMode);
            }

            vec![
                "run".to_string(),
                "--format".to_string(),
                "json".to_string(),
            ]
        }
        AgentDriver::ClaudeCode => vec![
            "-p".to_string(),
            params.prompt.clone(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--verbose".to_string(),
            "--permission-mode".to_string(),
            permission_argument(params.permission_mode).to_string(),
        ],
    };

    if let Some(session) = params
        .session
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        match driver {
            AgentDriver::Codex => argv.extend(["resume".to_string(), session.to_string()]),
            AgentDriver::OpenCode => argv.extend(["--session".to_string(), session.to_string()]),
            _ => argv.extend(["--resume".to_string(), session.to_string()]),
        }
    }

    if let Some(model) = params
        .model
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        argv.extend(["--model".to_string(), model.to_string()]);
    }

    if matches!(
        driver,
        AgentDriver::Codex | AgentDriver::Cursor | AgentDriver::OpenCode
    ) {
        argv.push(params.prompt.clone());
    }

    let _ = program_for(driver);

    Ok(argv)
}

fn codex_sandbox_argument(mode: PermissionMode) -> &'static str {
    match mode {
        PermissionMode::Supervised | PermissionMode::AutoAcceptEdits => "workspace-write",
        PermissionMode::Auto => "workspace-write",
        PermissionMode::FullAccess => "danger-full-access",
    }
}

pub fn canonical_directory(path: &Path) -> Result<PathBuf, ProcessRefusal> {
    let canonical = path
        .canonicalize()
        .map_err(|_| ProcessRefusal::InvalidDirectory)?;

    if !canonical.is_dir() {
        return Err(ProcessRefusal::InvalidDirectory);
    }

    let home = dirs_home();
    let is_system = canonical.starts_with("/System")
        || canonical.starts_with("/usr")
        || canonical.starts_with("/bin")
        || canonical.starts_with("/sbin")
        || canonical.starts_with("/etc");

    if canonical.parent().is_none() || canonical == home || is_system {
        return Err(ProcessRefusal::UnsafeDirectory);
    }

    Ok(canonical)
}

fn dirs_home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/nonexistent"))
}

pub fn ensure_directory_grant(
    requested: &Path,
    grant: &DirectoryGrant,
) -> Result<PathBuf, ProcessRefusal> {
    let canonical = canonical_directory(requested)?;

    if !canonical.starts_with(&grant.path) {
        return Err(ProcessRefusal::DirectoryOutsideGrant);
    }

    Ok(canonical)
}

pub fn git_head(path: &Path) -> Result<String, ProcessRefusal> {
    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(path)
        .output()
        .map_err(|_| ProcessRefusal::MissingHead)?;

    if !output.status.success() {
        return Err(ProcessRefusal::MissingHead);
    }

    String::from_utf8(output.stdout)
        .map(|head| head.trim().to_string())
        .ok()
        .filter(|head| !head.is_empty())
        .ok_or(ProcessRefusal::MissingHead)
}

pub fn is_dirty(path: &Path) -> Result<bool, ProcessRefusal> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(path)
        .output()
        .map_err(|_| ProcessRefusal::MissingHead)?;

    if !output.status.success() {
        return Err(ProcessRefusal::MissingHead);
    }

    Ok(!output.stdout.is_empty())
}

#[cfg(test)]
mod tests {
    #[test]
    fn opencode_readiness_requires_a_configured_provider() {
        assert!(!super::opencode_has_credentials("└  0 credentials\n"));
        assert!(super::opencode_has_credentials("└  1 credentials\n"));
        assert!(super::opencode_has_credentials(
            "└  0 credentials\n┌  Environment\n└  1 environment variable\n"
        ));
        assert!(!super::opencode_has_credentials("Unexpected output"));
    }
    #[test]
    fn agent_probe_wire_contract_matches_desktop() {
        let probe = super::AgentToolState::Ready {
            checked_at: "2026-09-08T10:00:00Z".to_string(),
            version: "1.0.0".to_string(),
        };
        assert_eq!(
            serde_json::to_value(probe).unwrap(),
            serde_json::json!({
                "state": "ready", "checkedAt": "2026-09-08T10:00:00Z", "version": "1.0.0"
            })
        );
        assert_eq!(
            serde_json::from_str::<super::AgentDriver>("\"opencode\"").unwrap(),
            super::AgentDriver::OpenCode
        );
    }
    use super::*;

    #[cfg(unix)]
    #[test]
    fn builds_one_argument_per_value_without_a_shell() {
        let params = RunParams {
            prompt: "inspect && echo unsafe".to_string(),
            session: Some("session id".to_string()),
            permission_mode: PermissionMode::AutoAcceptEdits,
            model: Some("model --bad".to_string()),
        };

        let argv = build_argv(AgentDriver::ClaudeCode, &params).expect("argv");

        assert_eq!(argv[0..2], ["-p", "inspect && echo unsafe"]);
        assert!(argv.contains(&"session id".to_string()));
        assert!(argv.contains(&"model --bad".to_string()));
        assert!(!argv.iter().any(|value| value == "sh" || value == "-c"));
    }

    #[test]
    fn rejects_empty_prompts() {
        let params = RunParams {
            prompt: "  ".to_string(),
            session: None,
            permission_mode: PermissionMode::Supervised,
            model: None,
        };

        assert_eq!(
            build_argv(AgentDriver::ClaudeCode, &params),
            Err(ProcessRefusal::InvalidPrompt)
        );
    }

    #[test]
    fn builds_codex_exec_arguments_from_typed_values() {
        let params = RunParams {
            prompt: "inspect the repo".to_string(),
            session: Some("thread-1".to_string()),
            permission_mode: PermissionMode::AutoAcceptEdits,
            model: Some("gpt-5-codex".to_string()),
        };

        let argv = build_argv(AgentDriver::Codex, &params).expect("argv");

        assert_eq!(
            argv,
            [
                "exec",
                "--json",
                "--sandbox",
                "workspace-write",
                "resume",
                "thread-1",
                "--model",
                "gpt-5-codex",
                "inspect the repo",
            ]
        );
    }

    #[test]
    fn builds_cursor_headless_arguments() {
        let params = RunParams {
            prompt: "inspect the repo".to_string(),
            session: Some("chat-1".to_string()),
            permission_mode: PermissionMode::Supervised,
            model: Some("gpt-5".to_string()),
        };

        let argv = build_argv(AgentDriver::Cursor, &params).expect("argv");

        assert_eq!(
            argv,
            [
                "-p",
                "--output-format",
                "stream-json",
                "--resume",
                "chat-1",
                "--model",
                "gpt-5",
                "inspect the repo",
            ]
        );
    }

    #[test]
    fn builds_grok_headless_arguments() {
        let params = RunParams {
            prompt: "inspect the repo".to_string(),
            session: Some("session-1".to_string()),
            permission_mode: PermissionMode::Supervised,
            model: Some("grok-build".to_string()),
        };

        let argv = build_argv(AgentDriver::Grok, &params).expect("argv");

        assert_eq!(
            argv,
            [
                "--no-auto-update",
                "-p",
                "inspect the repo",
                "--output-format",
                "json",
                "--resume",
                "session-1",
                "--model",
                "grok-build",
            ]
        );
    }

    #[test]
    fn builds_opencode_json_arguments() {
        let params = RunParams {
            prompt: "inspect the repo".to_string(),
            session: Some("session-1".to_string()),
            permission_mode: PermissionMode::Auto,
            model: Some("anthropic/claude-sonnet".to_string()),
        };

        let argv = build_argv(AgentDriver::OpenCode, &params).expect("argv");

        assert_eq!(
            argv,
            [
                "run",
                "--format",
                "json",
                "--session",
                "session-1",
                "--model",
                "anthropic/claude-sonnet",
                "inspect the repo",
            ]
        );
    }

    #[test]
    fn refuses_a_granted_symlink_that_resolves_outside_the_directory() {
        let root =
            std::env::temp_dir().join(format!("polychat-process-root-{}", std::process::id()));
        let outside =
            std::env::temp_dir().join(format!("polychat-process-outside-{}", std::process::id()));
        std::fs::create_dir_all(&root).expect("root");
        std::fs::create_dir_all(&outside).expect("outside");
        let link = root.join("link");

        std::os::unix::fs::symlink(&outside, &link).expect("symlink");

        let grant = DirectoryGrant {
            id: "directory-1".to_string(),
            path: canonical_directory(&root).expect("canonical root"),
            label: "root".to_string(),
            approved_at: "now".to_string(),
            last_used_at: None,
            is_git_repo: false,
        };

        assert_eq!(
            ensure_directory_grant(&link, &grant),
            Err(ProcessRefusal::DirectoryOutsideGrant)
        );

        std::fs::remove_dir_all(root).expect("remove root");
        std::fs::remove_dir_all(outside).expect("remove outside");
    }
}
