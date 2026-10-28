use std::path::PathBuf;

use tauri::State;

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

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|cause| cause.to_string())?
}

#[tauri::command]
pub fn agent_worktree(
    directory_id: String,
    conversation_id: String,
    directories: State<'_, DirectoryGrants>,
    root: State<'_, WorktreeRoot>,
) -> Result<Option<WorktreeInfo>, String> {
    Ok(resolve(&directories, &root, &directory_id, &conversation_id)?.worktree)
}

#[tauri::command]
pub async fn agent_snapshot(
    directory_id: String,
    conversation_id: String,
    directories: State<'_, DirectoryGrants>,
    root: State<'_, WorktreeRoot>,
) -> Result<Option<String>, String> {
    let workspace = resolve(&directories, &root, &directory_id, &conversation_id)?;

    if !workspace.is_git_repo {
        return Ok(None);
    }

    let directory = workspace.directory();

    blocking(move || changes::snapshot(&directory).map(Some)).await
}

#[tauri::command]
pub async fn agent_turn_changes(
    directory_id: String,
    conversation_id: String,
    from: String,
    to: String,
    directories: State<'_, DirectoryGrants>,
    root: State<'_, WorktreeRoot>,
) -> Result<TurnChanges, String> {
    let directory = resolve(&directories, &root, &directory_id, &conversation_id)?.directory();

    blocking(move || changes::diff(&directory, &from, &to)).await
}

#[tauri::command]
pub async fn agent_commit(
    directory_id: String,
    conversation_id: String,
    message: String,
    directories: State<'_, DirectoryGrants>,
    root: State<'_, WorktreeRoot>,
) -> Result<String, String> {
    let workspace = resolve(&directories, &root, &directory_id, &conversation_id)?;
    let directory = PathBuf::from(&workspace.require_worktree()?.path);

    blocking(move || changes::commit(&directory, &message)).await
}

#[tauri::command]
pub async fn agent_branch_changes(
    directory_id: String,
    conversation_id: String,
    directories: State<'_, DirectoryGrants>,
    root: State<'_, WorktreeRoot>,
) -> Result<BranchChanges, String> {
    let workspace = resolve(&directories, &root, &directory_id, &conversation_id)?;
    let worktree = workspace.require_worktree()?.clone();
    let repository = workspace.repository;

    blocking(move || changes::branch_changes(&repository, &worktree)).await
}
