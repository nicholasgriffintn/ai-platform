use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::encoding::base64;

const BRANCH_PREFIX: &str = "polychat/";
const MAX_PATCH_BYTES: usize = 256 * 1024;
const MAX_BRANCH_FILE_BYTES: usize = 5 * 1024 * 1024;
const MAX_BRANCH_FILES: usize = 500;

pub struct WorktreeRoot(pub PathBuf);

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: String,
    pub base_branch: Option<String>,
    pub base_commit: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub path: String,
    pub status: String,
    pub previous_path: Option<String>,
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnChanges {
    pub from: String,
    pub to: String,
    pub files: Vec<ChangedFile>,
    pub patch: String,
    pub truncated: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchFile {
    pub path: String,
    pub deleted: bool,
    pub executable: bool,
    pub content_base64: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchChanges {
    pub repository: String,
    pub branch: String,
    pub base_branch: String,
    pub base_commit: String,
    pub head_commit: String,
    pub files: Vec<BranchFile>,
}

fn git_with(directory: &Path, args: &[&str], envs: &[(&str, &str)]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .envs(envs.iter().copied())
        .current_dir(directory)
        .output()
        .map_err(|cause| format!("Git could not run: {cause}"))?;

    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();

        return Err(if detail.is_empty() {
            format!("git {} failed", args.first().copied().unwrap_or_default())
        } else {
            detail
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim_end().to_string())
}

fn git(directory: &Path, args: &[&str]) -> Result<String, String> {
    git_with(directory, args, &[])
}

fn git_bytes(directory: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(directory)
        .output()
        .map_err(|cause| format!("Git could not run: {cause}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(output.stdout)
}

pub fn is_object_id(value: &str) -> bool {
    (value.len() == 40 || value.len() == 64) && value.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn conversation_slug(conversation_id: &str) -> Option<String> {
    let slug: String = conversation_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(48)
        .collect();

    (!slug.is_empty()).then_some(slug)
}

fn repository_key(repository: &Path) -> String {
    let label: String = repository
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("repository")
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .take(40)
        .collect();
    let hash = repository
        .to_string_lossy()
        .bytes()
        .fold(0xcbf29ce484222325u64, |hash, byte| {
            (hash ^ u64::from(byte)).wrapping_mul(0x100000001b3)
        });

    format!("{label}-{:08x}", hash as u32)
}

pub fn worktree_path(root: &Path, repository: &Path, slug: &str) -> PathBuf {
    root.join(repository_key(repository)).join(slug)
}

fn branch_config(repository: &Path, branch: &str, key: &str) -> Option<String> {
    git(repository, &["config", "--get", &format!("branch.{branch}.{key}")])
        .ok()
        .filter(|value| !value.is_empty())
}

fn read_worktree(repository: &Path, path: &Path, branch: &str) -> Result<WorktreeInfo, String> {
    let base_commit = match branch_config(repository, branch, "polychatbase") {
        Some(commit) => commit,
        None => git(repository, &["rev-parse", branch])?,
    };

    Ok(WorktreeInfo {
        path: path.to_string_lossy().into_owned(),
        branch: branch.to_string(),
        base_branch: branch_config(repository, branch, "polychatbasebranch"),
        base_commit,
    })
}

pub fn find_worktree(
    root: &Path,
    repository: &Path,
    conversation_id: &str,
) -> Option<WorktreeInfo> {
    let slug = conversation_slug(conversation_id)?;
    let path = worktree_path(root, repository, &slug);

    path.join(".git")
        .exists()
        .then(|| read_worktree(repository, &path, &format!("{BRANCH_PREFIX}{slug}")).ok())
        .flatten()
}

pub fn ensure_worktree(
    root: &Path,
    repository: &Path,
    conversation_id: &str,
) -> Result<WorktreeInfo, String> {
    if let Some(existing) = find_worktree(root, repository, conversation_id) {
        return Ok(existing);
    }

    let slug = conversation_slug(conversation_id)
        .ok_or_else(|| "The conversation has no usable identifier.".to_string())?;
    let path = worktree_path(root, repository, &slug);
    let branch = format!("{BRANCH_PREFIX}{slug}");
    let path_text = path.to_string_lossy().into_owned();

    git(repository, &["worktree", "prune"])?;
    std::fs::create_dir_all(path.parent().unwrap_or(root))
        .map_err(|cause| format!("The worktree folder could not be created: {cause}"))?;

    let branch_exists = git(
        repository,
        &["rev-parse", "--verify", "--quiet", &format!("refs/heads/{branch}")],
    )
    .is_ok();

    if branch_exists {
        git(repository, &["worktree", "add", &path_text, &branch])?;
    } else {
        let base_commit = git(repository, &["rev-parse", "HEAD"])?;
        let base_branch = git(repository, &["symbolic-ref", "--short", "-q", "HEAD"]).ok();

        git(
            repository,
            &["worktree", "add", "-b", &branch, &path_text, &base_commit],
        )?;
        git(
            repository,
            &["config", &format!("branch.{branch}.polychatbase"), &base_commit],
        )?;

        if let Some(base_branch) = base_branch.filter(|value| !value.is_empty()) {
            git(
                repository,
                &[
                    "config",
                    &format!("branch.{branch}.polychatbasebranch"),
                    &base_branch,
                ],
            )?;
        }
    }

    read_worktree(repository, &path, &branch)
}

pub fn snapshot(directory: &Path) -> Result<String, String> {
    let index = git(directory, &["rev-parse", "--path-format=absolute", "--git-path", "index"])?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let scratch = std::env::temp_dir().join(format!(
        "polychat-index-{}-{nanos}",
        std::process::id()
    ));

    if Path::new(&index).exists() {
        std::fs::copy(&index, &scratch)
            .map_err(|cause| format!("The git index could not be copied: {cause}"))?;
    }

    let scratch_text = scratch.to_string_lossy().into_owned();
    let envs = [("GIT_INDEX_FILE", scratch_text.as_str())];
    let tree = git_with(directory, &["add", "-A"], &envs)
        .and_then(|_| git_with(directory, &["write-tree"], &envs));

    let _ = std::fs::remove_file(&scratch);

    tree
}

pub fn parse_name_status(output: &str) -> Vec<ChangedFile> {
    output
        .lines()
        .filter_map(|line| {
            let mut fields = line.split('\t');
            let code = fields.next()?;
            let first = fields.next()?;
            let second = fields.next();
            let status = match code.chars().next()? {
                'A' => "added",
                'D' => "deleted",
                'R' => "renamed",
                'C' => "copied",
                _ => "modified",
            };

            Some(match second {
                Some(path) => ChangedFile {
                    path: path.to_string(),
                    status: status.to_string(),
                    previous_path: Some(first.to_string()),
                    additions: None,
                    deletions: None,
                },
                None => ChangedFile {
                    path: first.to_string(),
                    status: status.to_string(),
                    previous_path: None,
                    additions: None,
                    deletions: None,
                },
            })
        })
        .collect()
}

fn parse_numstat(output: &str) -> HashMap<String, (Option<u32>, Option<u32>)> {
    output
        .lines()
        .filter_map(|line| {
            let mut fields = line.splitn(3, '\t');
            let additions = fields.next()?.parse().ok();
            let deletions = fields.next()?.parse().ok();
            let path = fields.next()?;
            let path = path
                .rsplit_once(" => ")
                .map(|(_, renamed)| renamed.trim_end_matches('}'))
                .unwrap_or(path);

            Some((path.to_string(), (additions, deletions)))
        })
        .collect()
}

fn truncate_patch(patch: String) -> (String, bool) {
    if patch.len() <= MAX_PATCH_BYTES {
        return (patch, false);
    }

    let mut end = MAX_PATCH_BYTES;

    while !patch.is_char_boundary(end) {
        end -= 1;
    }

    let cut = patch[..end].rfind("\ndiff --git ").unwrap_or(end);

    (patch[..cut].to_string(), true)
}

pub fn diff(directory: &Path, from: &str, to: &str) -> Result<TurnChanges, String> {
    if !is_object_id(from) || !is_object_id(to) {
        return Err("A change snapshot is not a git object id.".to_string());
    }

    let mut files = parse_name_status(&git(
        directory,
        &["diff", "--name-status", "--find-renames", from, to],
    )?);
    let stats = parse_numstat(&git(
        directory,
        &["diff", "--numstat", "--find-renames", from, to],
    )?);

    for file in &mut files {
        if let Some((additions, deletions)) = stats.get(&file.path) {
            file.additions = *additions;
            file.deletions = *deletions;
        }
    }

    let (patch, truncated) = truncate_patch(git(
        directory,
        &["diff", "--no-color", "--no-ext-diff", "--find-renames", from, to],
    )?);

    Ok(TurnChanges {
        from: from.to_string(),
        to: to.to_string(),
        files,
        patch,
        truncated,
    })
}

pub fn commit(directory: &Path, message: &str) -> Result<String, String> {
    let message = message.trim();

    if message.is_empty() {
        return Err("Write a commit message first.".to_string());
    }

    git(directory, &["add", "-A"])?;

    if git(directory, &["diff", "--cached", "--quiet"]).is_ok() {
        return Err("There is nothing to commit.".to_string());
    }

    git(directory, &["commit", "-m", message])?;
    git(directory, &["rev-parse", "HEAD"])
}

pub fn github_repository(remote: &str) -> Option<String> {
    let trimmed = remote.trim().trim_end_matches('/').trim_end_matches(".git");
    let path = trimmed
        .strip_prefix("https://github.com/")
        .or_else(|| trimmed.strip_prefix("http://github.com/"))
        .or_else(|| trimmed.strip_prefix("ssh://git@github.com/"))
        .or_else(|| trimmed.strip_prefix("git@github.com:"))?;
    let mut parts = path.split('/');
    let owner = parts.next().filter(|part| !part.is_empty())?;
    let name = parts.next().filter(|part| !part.is_empty())?;

    parts
        .next()
        .is_none()
        .then(|| format!("{owner}/{name}"))
}

pub fn branch_changes(repository: &Path, worktree: &WorktreeInfo) -> Result<BranchChanges, String> {
    let directory = Path::new(&worktree.path);
    let remote = git(repository, &["remote", "get-url", "origin"])
        .map_err(|_| "This repository has no origin remote.".to_string())?;
    let repository_name = github_repository(&remote)
        .ok_or_else(|| "The origin remote is not a GitHub repository.".to_string())?;
    let base_branch = worktree
        .base_branch
        .clone()
        .ok_or_else(|| "This conversation did not start from a branch.".to_string())?;
    let remote_base = format!("refs/remotes/origin/{base_branch}");

    git(repository, &["rev-parse", "--verify", "--quiet", &remote_base])
        .map_err(|_| format!("origin/{base_branch} is not available locally. Fetch it first."))?;

    let head_commit = git(directory, &["rev-parse", "HEAD"])?;
    let base_commit = git(directory, &["merge-base", "HEAD", &remote_base])?;
    let changed = git(
        directory,
        &["diff", "--name-status", "--no-renames", &base_commit, &head_commit],
    )?;
    let entries = parse_name_status(&changed);

    if entries.is_empty() {
        return Err("This branch has no committed changes yet.".to_string());
    }

    if entries.len() > MAX_BRANCH_FILES {
        return Err(format!(
            "This branch changes more than {MAX_BRANCH_FILES} files, which is too many to send."
        ));
    }

    let files = entries
        .into_iter()
        .map(|entry| {
            if entry.status == "deleted" {
                return Ok(BranchFile {
                    path: entry.path,
                    deleted: true,
                    executable: false,
                    content_base64: None,
                });
            }

            let object = format!("{head_commit}:{}", entry.path);
            let mode = git(directory, &["ls-tree", &head_commit, "--", &entry.path])?
                .split_whitespace()
                .next()
                .unwrap_or("100644")
                .to_string();

            if mode != "100644" && mode != "100755" {
                return Err(format!("{} is a link or submodule, which can't be sent.", entry.path));
            }

            let content = git_bytes(directory, &["cat-file", "blob", &object])?;

            if content.len() > MAX_BRANCH_FILE_BYTES {
                return Err(format!("{} is larger than 5 MB.", entry.path));
            }

            Ok(BranchFile {
                path: entry.path,
                deleted: false,
                executable: mode == "100755",
                content_base64: Some(base64(&content)),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(BranchChanges {
        repository: repository_name,
        branch: worktree.branch.clone(),
        base_branch,
        base_commit,
        head_commit,
        files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("polychat-{name}-{nanos}"));

        std::fs::create_dir_all(&root).unwrap();
        root.canonicalize().unwrap()
    }

    fn repository(root: &Path) -> PathBuf {
        let repository = root.join("repo");

        std::fs::create_dir_all(&repository).unwrap();
        git(&repository, &["init", "-q", "-b", "main"]).unwrap();
        std::fs::write(repository.join("readme.md"), "hello\n").unwrap();
        git(&repository, &["add", "-A"]).unwrap();
        git_with(
            &repository,
            &["-c", "commit.gpgsign=false", "commit", "-q", "-m", "start"],
            &[
                ("GIT_AUTHOR_NAME", "Test"),
                ("GIT_AUTHOR_EMAIL", "test@example.com"),
                ("GIT_COMMITTER_NAME", "Test"),
                ("GIT_COMMITTER_EMAIL", "test@example.com"),
            ],
        )
        .unwrap();

        repository
    }

    #[test]
    fn gives_each_conversation_its_own_branch_and_keeps_it() {
        let root = temp_root("worktree");
        let repository = repository(&root);
        let worktrees = root.join("worktrees");
        let first = ensure_worktree(&worktrees, &repository, "conversation/1").unwrap();

        assert_eq!(first.branch, "polychat/conversation-1");
        assert_eq!(first.base_branch.as_deref(), Some("main"));
        assert!(Path::new(&first.path).join("readme.md").exists());
        assert_eq!(
            ensure_worktree(&worktrees, &repository, "conversation/1").unwrap(),
            first
        );
        assert_ne!(
            ensure_worktree(&worktrees, &repository, "conversation-2")
                .unwrap()
                .path,
            first.path
        );
        assert_eq!(git(&repository, &["status", "--porcelain"]).unwrap(), "");
    }

    #[test]
    fn diffs_a_turn_including_new_files_without_touching_the_index() {
        let root = temp_root("snapshot");
        let repository = repository(&root);
        let before = snapshot(&repository).unwrap();

        std::fs::write(repository.join("readme.md"), "hello\nworld\n").unwrap();
        std::fs::write(repository.join("notes.txt"), "new\n").unwrap();

        let after = snapshot(&repository).unwrap();
        let changes = diff(&repository, &before, &after).unwrap();
        let readme = changes
            .files
            .iter()
            .find(|file| file.path == "readme.md")
            .unwrap();

        assert_eq!(readme.status, "modified");
        assert_eq!((readme.additions, readme.deletions), (Some(1), Some(0)));
        assert!(changes
            .files
            .iter()
            .any(|file| file.path == "notes.txt" && file.status == "added"));
        assert!(changes.patch.contains("+world"));
        assert_eq!(
            git(&repository, &["diff", "--cached", "--name-only"]).unwrap(),
            ""
        );
    }

    #[test]
    fn reads_github_repositories_from_remotes() {
        assert_eq!(
            github_repository("https://github.com/owner/name.git").as_deref(),
            Some("owner/name")
        );
        assert_eq!(
            github_repository("git@github.com:owner/name.git").as_deref(),
            Some("owner/name")
        );
        assert_eq!(github_repository("https://gitlab.com/owner/name"), None);
        assert_eq!(github_repository("https://github.com/owner"), None);
    }

    #[test]
    fn refuses_snapshot_ids_that_are_not_objects() {
        let root = temp_root("refuse");
        let repository = repository(&root);

        assert!(diff(&repository, "HEAD", "--output=/tmp/x").is_err());
    }
}
