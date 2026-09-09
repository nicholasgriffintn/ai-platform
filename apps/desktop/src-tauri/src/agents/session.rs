use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex as AsyncMutex;

use super::process::{self, AgentDriver, DirectoryGrants, ProcessRefusal};
use crate::lines::MAX_STREAM_LINE;
use crate::timestamp;

const MAX_DIAGNOSTIC_CHARS: usize = 2000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStartRequest {
    pub driver: AgentDriver,
    pub directory_id: String,
    pub conversation_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDescriptor {
    pub session_key: String,
    pub driver: AgentDriver,
    pub directory_id: String,
    pub directory_path: String,
    pub started_at: String,
    pub head: Option<String>,
    pub adopted: bool,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SessionEvent {
    #[serde(rename_all = "camelCase")]
    Ready { session_key: String, at: String },
    #[serde(rename_all = "camelCase")]
    Message { session_key: String, data: String },
    #[serde(rename_all = "camelCase")]
    Diagnostic {
        session_key: String,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    Exited {
        session_key: String,
        code: Option<i32>,
        at: String,
    },
}

struct SessionHandle {
    child: Child,
    stdin: ChildStdin,
}

#[derive(Default, Clone)]
pub struct AgentSessionRegistry {
    sessions: Arc<Mutex<HashMap<String, Arc<AsyncMutex<SessionHandle>>>>>,
}

pub fn session_key(driver: AgentDriver, conversation_id: &str) -> String {
    format!("{}:{conversation_id}", driver_slug(driver))
}

fn driver_slug(driver: AgentDriver) -> &'static str {
    match driver {
        AgentDriver::ClaudeCode => "claude-code",
        AgentDriver::Codex => "codex",
        AgentDriver::Cursor => "cursor",
        AgentDriver::Grok => "grok",
        AgentDriver::OpenCode => "opencode",
    }
}

impl AgentSessionRegistry {
    fn get(&self, key: &str) -> Option<Arc<AsyncMutex<SessionHandle>>> {
        self.sessions.lock().ok()?.get(key).cloned()
    }

    fn insert(&self, key: String, handle: Arc<AsyncMutex<SessionHandle>>) -> Result<(), String> {
        self.sessions
            .lock()
            .map_err(|_| "The session registry is unavailable.".to_string())?
            .insert(key, handle);

        Ok(())
    }

    fn remove(&self, key: &str) -> Option<Arc<AsyncMutex<SessionHandle>>> {
        self.sessions.lock().ok()?.remove(key)
    }

    fn remove_if_current(&self, key: &str, handle: &Arc<AsyncMutex<SessionHandle>>) {
        if let Ok(mut sessions) = self.sessions.lock() {
            if sessions
                .get(key)
                .is_some_and(|current| Arc::ptr_eq(current, handle))
            {
                sessions.remove(key);
            }
        }
    }

    pub fn is_running(&self, key: &str) -> bool {
        self.get(key).is_some()
    }

    pub async fn stop_all(&self) {
        let handles: Vec<Arc<AsyncMutex<SessionHandle>>> = match self.sessions.lock() {
            Ok(mut sessions) => sessions.drain().map(|(_, handle)| handle).collect(),
            Err(_) => return,
        };

        for handle in handles {
            let mut guard = handle.lock().await;
            let _ = guard.stdin.shutdown().await;
            let _ = guard.child.kill().await;
        }
    }
}

pub async fn start(
    request: SessionStartRequest,
    on_event: Channel<SessionEvent>,
    directories: &DirectoryGrants,
    registry: &AgentSessionRegistry,
) -> Result<SessionDescriptor, String> {
    let grant = directories
        .get(&request.directory_id)
        .map_err(|cause| format!("{cause:?}"))?;
    let directory = process::ensure_directory_grant(&grant.path, &grant)
        .map_err(|cause| format!("{cause:?}"))?;
    let key = session_key(request.driver, &request.conversation_id);
    let head = grant
        .is_git_repo
        .then(|| process::git_head(&directory).ok())
        .flatten();
    let at = timestamp();

    if let Some(handle) = registry.get(&key) {
        let alive = matches!(handle.lock().await.child.try_wait(), Ok(None));

        if alive {
            return Ok(SessionDescriptor {
                session_key: key,
                driver: request.driver,
                directory_id: request.directory_id,
                directory_path: directory.to_string_lossy().into_owned(),
                started_at: at,
                head,
                adopted: true,
            });
        }

        registry.remove(&key);
    }

    let argv = process::session_argv(request.driver)
        .ok_or_else(|| format!("{:?}", ProcessRefusal::SessionsUnsupported))?;
    let program = process::program_for(request.driver);
    let mut child = Command::new(crate::programs::resolve_program(program.program))
        .args(argv)
        .current_dir(&directory)
        .env("NO_COLOR", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|cause| {
            if cause.kind() == std::io::ErrorKind::NotFound {
                format!("{:?}", ProcessRefusal::NotInstalled)
            } else {
                cause.to_string()
            }
        })?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "The agent produced no input stream.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "The agent produced no output stream.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "The agent produced no diagnostic stream.".to_string())?;

    let handle = Arc::new(AsyncMutex::new(SessionHandle { child, stdin }));
    registry.insert(key.clone(), handle.clone())?;

    spawn_stdout_pump(
        key.clone(),
        stdout,
        on_event.clone(),
        registry.clone(),
        handle,
    );
    spawn_stderr_pump(key.clone(), stderr, on_event.clone());

    directories
        .touch(&request.directory_id, at.clone())
        .map_err(|cause| format!("{cause:?}"))?;
    let _ = on_event.send(SessionEvent::Ready {
        session_key: key.clone(),
        at: at.clone(),
    });

    Ok(SessionDescriptor {
        session_key: key,
        driver: request.driver,
        directory_id: request.directory_id,
        directory_path: directory.to_string_lossy().into_owned(),
        started_at: at,
        head,
        adopted: false,
    })
}

fn spawn_stdout_pump(
    key: String,
    stdout: tokio::process::ChildStdout,
    on_event: Channel<SessionEvent>,
    registry: AgentSessionRegistry,
    handle: Arc<AsyncMutex<SessionHandle>>,
) {
    tauri::async_runtime::spawn(async move {
        let mut segments = BufReader::new(stdout).split(b'\n');

        while let Ok(Some(segment)) = segments.next_segment().await {
            if segment.len() > MAX_STREAM_LINE {
                let _ = on_event.send(SessionEvent::Diagnostic {
                    session_key: key.clone(),
                    message: "The agent sent a message too large to read.".to_string(),
                });

                continue;
            }

            let data = String::from_utf8_lossy(&segment).trim_end().to_string();

            if data.is_empty() {
                continue;
            }

            if on_event
                .send(SessionEvent::Message {
                    session_key: key.clone(),
                    data,
                })
                .is_err()
            {
                break;
            }
        }

        registry.remove_if_current(&key, &handle);

        let _ = on_event.send(SessionEvent::Exited {
            session_key: key,
            code: None,
            at: timestamp(),
        });
    });
}

fn spawn_stderr_pump(
    key: String,
    stderr: tokio::process::ChildStderr,
    on_event: Channel<SessionEvent>,
) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let message: String = line.trim().chars().take(MAX_DIAGNOSTIC_CHARS).collect();

            if message.is_empty() {
                continue;
            }

            if on_event
                .send(SessionEvent::Diagnostic {
                    session_key: key.clone(),
                    message,
                })
                .is_err()
            {
                break;
            }
        }
    });
}

pub async fn send(
    session_key: &str,
    payload: &str,
    registry: &AgentSessionRegistry,
) -> Result<(), String> {
    let handle = registry
        .get(session_key)
        .ok_or_else(|| "That agent session is no longer running.".to_string())?;

    if payload.contains('\n') {
        return Err("An agent message cannot contain a line break.".to_string());
    }

    let mut guard = handle.lock().await;
    let line = format!("{payload}\n");

    guard
        .stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|cause| cause.to_string())?;
    guard.stdin.flush().await.map_err(|cause| cause.to_string())
}

pub async fn stop(session_key: &str, registry: &AgentSessionRegistry) -> Result<(), String> {
    let Some(handle) = registry.remove(session_key) else {
        return Ok(());
    };
    let mut guard = handle.lock().await;
    let _ = guard.stdin.shutdown().await;
    let _ = guard.child.kill().await;

    Ok(())
}

#[cfg(all(test, unix))]
mod exit_tests {
    use super::*;
    use tauri::ipc::InvokeResponseBody;

    #[tokio::test]
    async fn removes_the_registry_entry_once_the_process_exits_on_its_own() {
        let registry = AgentSessionRegistry::default();
        let key = "codex:conversation-exit".to_string();
        let mut child = Command::new("/bin/sh")
            .args(["-c", "exit 0"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let handle = Arc::new(AsyncMutex::new(SessionHandle { child, stdin }));
        registry.insert(key.clone(), handle.clone()).unwrap();
        let on_event = Channel::<SessionEvent>::new(|body| {
            let _: InvokeResponseBody = body;
            Ok(())
        });

        spawn_stdout_pump(key.clone(), stdout, on_event, registry.clone(), handle);

        tokio::time::timeout(std::time::Duration::from_secs(5), async {
            while registry.is_running(&key) {
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();

        assert!(!registry.is_running(&key));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_a_session_by_driver_and_conversation() {
        assert_eq!(
            session_key(AgentDriver::Codex, "conversation-1"),
            "codex:conversation-1"
        );
        assert_ne!(
            session_key(AgentDriver::Codex, "conversation-1"),
            session_key(AgentDriver::ClaudeCode, "conversation-1")
        );
    }

    #[test]
    fn reports_whether_a_session_is_running() {
        let registry = AgentSessionRegistry::default();

        assert!(!registry.is_running("codex:conversation-1"));
    }

    #[test]
    fn serialises_events_in_the_shape_the_bridge_expects() {
        assert_eq!(
            serde_json::to_value(SessionEvent::Message {
                session_key: "codex:conversation-1".to_string(),
                data: "{\"id\":1}".to_string(),
            })
            .unwrap(),
            serde_json::json!({
                "type": "message",
                "sessionKey": "codex:conversation-1",
                "data": "{\"id\":1}"
            })
        );
        assert_eq!(
            serde_json::to_value(SessionEvent::Diagnostic {
                session_key: "codex:conversation-1".to_string(),
                message: "boom".to_string(),
            })
            .unwrap(),
            serde_json::json!({
                "type": "diagnostic",
                "sessionKey": "codex:conversation-1",
                "message": "boom"
            })
        );
    }
}
