use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use super::changes::{self, BranchChanges, TurnChanges, WorktreeInfo, WorktreeRoot};
use super::process::{self, DirectoryGrants};

pub(crate) struct Workspace {
    repository: PathBuf,
    worktree: Option<WorktreeInfo>,
    is_git_repo: bool,
}

impl Workspace {
    pub(crate) fn directory(&self) -> PathBuf {
        self.worktree
            .as_ref()
            .map(|info| PathBuf::from(&info.path))
            .unwrap_or_else(|| self.repository.clone())
    }

    fn require_worktree(&self) -> Result<&WorktreeInfo, String> {
        self.worktree
            .as_ref()
            .ok_or_else(|| "This conversation has no worktree of its own.".to_string())
    }
}

pub(crate) fn resolve(
    directories: &DirectoryGrants,
    root: &WorktreeRoot,
    directory_id: &str,
    conversation_id: &str,
) -> Result<Workspace, String> {
    let grant = directories
        .get(directory_id)
        .map_err(|cause| format!("{cause:?}"))?;
    let repository = process::ensure_directory_grant(&grant.path, &grant)
        .map_err(|cause| format!("{cause:?}"))?;
    let is_git_repo = process::git_head(&repository).is_ok();
    let worktree = is_git_repo
        .then(|| changes::find_worktree(&root.0, &repository, conversation_id))
        .flatten();

    Ok(Workspace {
        repository,
        worktree,
        is_git_repo,
    })
}

async fn in_workspace<T: Send + 'static>(
    app: AppHandle,
    directory_id: String,
    conversation_id: String,
    work: impl FnOnce(Workspace) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        work(resolve(
            &app.state::<DirectoryGrants>(),
            &app.state::<WorktreeRoot>(),
            &directory_id,
            &conversation_id,
        )?)
    })
    .await
    .map_err(|cause| cause.to_string())?
}

#[tauri::command]
pub async fn agent_worktree(
    directory_id: String,
    conversation_id: String,
    app: AppHandle,
) -> Result<Option<WorktreeInfo>, String> {
    in_workspace(app, directory_id, conversation_id, |workspace| {
        Ok(workspace.worktree)
    })
    .await
}

#[tauri::command]
pub async fn agent_snapshot(
    directory_id: String,
    conversation_id: String,
    app: AppHandle,
) -> Result<Option<String>, String> {
    in_workspace(app, directory_id, conversation_id, |workspace| {
        if !workspace.is_git_repo {
            return Ok(None);
        }

        changes::snapshot(&workspace.directory()).map(Some)
    })
    .await
}

#[tauri::command]
pub async fn agent_turn_changes(
    directory_id: String,
    conversation_id: String,
    from: String,
    to: String,
    app: AppHandle,
) -> Result<TurnChanges, String> {
    in_workspace(app, directory_id, conversation_id, move |workspace| {
        changes::diff(&workspace.directory(), &from, &to)
    })
    .await
}

#[tauri::command]
pub async fn agent_commit(
    directory_id: String,
    conversation_id: String,
    message: String,
    app: AppHandle,
) -> Result<String, String> {
    in_workspace(app, directory_id, conversation_id, move |workspace| {
        changes::commit(
            &PathBuf::from(&workspace.require_worktree()?.path),
            &message,
        )
    })
    .await
}

#[tauri::command]
pub async fn agent_branch_changes(
    directory_id: String,
    conversation_id: String,
    app: AppHandle,
) -> Result<BranchChanges, String> {
    in_workspace(app, directory_id, conversation_id, |workspace| {
        changes::branch_changes(&workspace.repository, workspace.require_worktree()?)
    })
    .await
}
