use super::process::{self, DirectoryGrants, ProcessRunRequest};
use crate::{
    runs::{RunRegistry, StreamEvent},
    store::Store,
    timestamp,
};
use std::process::Stdio;
use tauri::ipc::Channel;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

pub async fn run(
    run_id: String,
    request: ProcessRunRequest,
    on_event: Channel<StreamEvent>,
    directories: &DirectoryGrants,
    registry: &RunRegistry,
    store: &Store,
) -> Result<(), String> {
    let program = process::program_for(request.driver);
    let command = Command::new(crate::programs::resolve_program(program.program));
    run_command(
        run_id,
        request,
        on_event,
        directories,
        registry,
        store,
        command,
    )
    .await
}

async fn run_command(
    run_id: String,
    request: ProcessRunRequest,
    on_event: Channel<StreamEvent>,
    directories: &DirectoryGrants,
    registry: &RunRegistry,
    store: &Store,
    mut command: Command,
) -> Result<(), String> {
    let grant = directories
        .get(&request.directory_id)
        .map_err(|cause| format!("{cause:?}"))?;
    let directory = process::ensure_directory_grant(&grant.path, &grant)
        .map_err(|cause| format!("{cause:?}"))?;
    let starting_head = if grant.is_git_repo {
        Some(process::git_head(&directory).map_err(|cause| format!("{cause:?}"))?)
    } else {
        None
    };

    if grant.is_git_repo
        && process::is_dirty(&directory).map_err(|cause| format!("{cause:?}"))?
        && !request.acknowledge_dirty
    {
        return Err(format!("{:?}", process::ProcessRefusal::DirtyTree));
    }

    let argv = process::build_argv(
        request.driver,
        &process::RunParams {
            prompt: request.prompt,
            session: request.session,
            permission_mode: request.permission_mode,
            model: request.model,
        },
    )
    .map_err(|cause| format!("{cause:?}"))?;

    let _guard = registry
        .acquire_directory(&directory, &run_id)
        .ok_or_else(|| format!("{:?}", process::ProcessRefusal::AlreadyRunning))?;

    if request.driver == process::AgentDriver::OpenCode {
        command.env(
            "OPENCODE_PERMISSION",
            if request.permission_mode == process::PermissionMode::Auto {
                "{\"*\":\"allow\"}"
            } else {
                "{\"*\":\"ask\"}"
            },
        );
    }
    let child_result = command
        .kill_on_drop(true)
        .args(argv)
        .current_dir(&directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();
    let mut child = match child_result {
        Ok(child) => child,
        Err(cause) => {
            return Err(if cause.kind() == std::io::ErrorKind::NotFound {
                format!("{:?}", process::ProcessRefusal::NotInstalled)
            } else {
                cause.to_string()
            });
        }
    };
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "The agent produced no output stream.".to_string())?;
    let mut lines = BufReader::new(stdout).lines();

    let _ = on_event.send(StreamEvent::Started {
        run_id: run_id.clone(),
        endpoint_id: request.directory_id.clone(),
        at: timestamp(),
        head: starting_head,
    });
    let used_at = timestamp();
    directories
        .touch(&request.directory_id, used_at.clone())
        .map_err(|cause| format!("{cause:?}"))?;
    store.mark_agent_directory_used(&request.directory_id, &used_at)?;
    let _ = on_event.send(StreamEvent::Progress {
        run_id: run_id.clone(),
        state: "generating".to_string(),
    });

    loop {
        let line = tokio::select! {
            line = lines.next_line() => line.map_err(|cause| cause.to_string())?,
            _ = tokio::time::sleep(crate::CANCEL_POLL) => {
                if !registry.is_cancelled(&run_id) { continue; }
                None
            }
        };
        if registry.is_cancelled(&run_id) {
            let _ = child.kill().await;
            let _ = on_event.send(StreamEvent::Finished {
                run_id,
                reason: "cancelled".to_string(),
                at: timestamp(),
            });

            return Ok(());
        }

        let Some(line) = line else {
            break;
        };
        let _ = on_event.send(StreamEvent::RawOutput {
            run_id: run_id.clone(),
            data: format!("{line}\n"),
        });
    }

    let status = child.wait().await.map_err(|cause| cause.to_string())?;
    let reason = if status.success() {
        "complete"
    } else {
        "interrupted"
    };
    let _ = on_event.send(StreamEvent::Finished {
        run_id,
        reason: reason.to_string(),
        at: timestamp(),
    });

    Ok(())
}

#[cfg(all(test, unix))]
#[path = "runner_tests.rs"]
mod tests;
