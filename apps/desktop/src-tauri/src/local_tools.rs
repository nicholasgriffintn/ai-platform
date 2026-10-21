use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::agents::process::{DirectoryGrant, DirectoryGrants};

const MAX_LIST_ENTRIES: usize = 500;
const MAX_READ_BYTES: usize = 512 * 1024;
const MAX_WRITE_BYTES: usize = 1024 * 1024;
const MAX_SEARCH_MATCHES: usize = 200;
const MAX_SEARCH_VISITS: usize = 20_000;
const MAX_SEARCHED_FILE_BYTES: u64 = 1024 * 1024;
const SKIPPED_DIRECTORIES: [&str; 5] = [".git", "node_modules", "target", "dist", ".next"];

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum LocalToolInput {
    ListDirectory {
        #[serde(default)]
        path: String,
    },
    ReadFile {
        path: String,
    },
    SearchFiles {
        query: String,
        #[serde(default)]
        path: String,
        #[serde(default)]
        contents: bool,
    },
    WriteFile {
        path: String,
        content: String,
        #[serde(default)]
        overwrite: bool,
    },
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalToolRequest {
    pub directory_id: String,
    pub input: LocalToolInput,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub kind: &'static str,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub path: String,
    pub line: Option<usize>,
    pub excerpt: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum LocalToolResult {
    ListDirectory {
        path: String,
        entries: Vec<DirectoryEntry>,
        truncated: bool,
    },
    ReadFile {
        path: String,
        content: String,
        size: u64,
        truncated: bool,
    },
    SearchFiles {
        matches: Vec<SearchMatch>,
        truncated: bool,
    },
    WriteFile {
        path: String,
        bytes: usize,
        created: bool,
    },
}

#[derive(Debug, PartialEq, Eq)]
pub enum LocalToolRefusal {
    UnknownDirectory,
    PathOutsideGrant,
    NotFound,
    NotAFile,
    NotADirectory,
    TooLarge,
    NotText,
    AlreadyExists,
    Io(String),
}

impl LocalToolRefusal {
    pub fn describe(&self) -> String {
        match self {
            Self::UnknownDirectory => {
                "That folder has not been granted on this desktop.".to_string()
            }
            Self::PathOutsideGrant => "The path leaves the granted folder.".to_string(),
            Self::NotFound => "Nothing exists at that path.".to_string(),
            Self::NotAFile => "That path is not a file.".to_string(),
            Self::NotADirectory => "That path is not a folder.".to_string(),
            Self::TooLarge => "That file is too large to handle here.".to_string(),
            Self::NotText => "That file is not text.".to_string(),
            Self::AlreadyExists => {
                "A file already exists at that path; pass overwrite to replace it.".to_string()
            }
            Self::Io(message) => message.clone(),
        }
    }
}

fn io(error: std::io::Error) -> LocalToolRefusal {
    match error.kind() {
        std::io::ErrorKind::NotFound => LocalToolRefusal::NotFound,
        _ => LocalToolRefusal::Io(error.to_string()),
    }
}

pub fn relative_within(grant_root: &Path, relative: &str) -> Result<PathBuf, LocalToolRefusal> {
    let candidate = Path::new(relative);

    if candidate.is_absolute() {
        return Err(LocalToolRefusal::PathOutsideGrant);
    }

    let mut joined = grant_root.to_path_buf();

    for component in candidate.components() {
        match component {
            Component::Normal(part) => joined.push(part),
            Component::CurDir => {}
            _ => return Err(LocalToolRefusal::PathOutsideGrant),
        }
    }

    Ok(joined)
}

fn resolve_existing(grant: &DirectoryGrant, relative: &str) -> Result<PathBuf, LocalToolRefusal> {
    let joined = relative_within(&grant.path, relative)?;
    let canonical = joined.canonicalize().map_err(io)?;

    if !canonical.starts_with(&grant.path) {
        return Err(LocalToolRefusal::PathOutsideGrant);
    }

    Ok(canonical)
}

fn resolve_for_write(grant: &DirectoryGrant, relative: &str) -> Result<PathBuf, LocalToolRefusal> {
    let joined = relative_within(&grant.path, relative)?;
    let parent = joined
        .parent()
        .ok_or(LocalToolRefusal::PathOutsideGrant)?
        .canonicalize()
        .map_err(io)?;

    if !parent.starts_with(&grant.path) {
        return Err(LocalToolRefusal::PathOutsideGrant);
    }

    let name = joined
        .file_name()
        .ok_or(LocalToolRefusal::PathOutsideGrant)?;
    let target = parent.join(name);

    if fs::symlink_metadata(&target).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err(LocalToolRefusal::PathOutsideGrant);
    }

    Ok(target)
}

fn display_path(grant: &DirectoryGrant, path: &Path) -> String {
    path.strip_prefix(&grant.path)
        .map(|relative| relative.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string())
}

fn modified_at(metadata: &fs::Metadata) -> Option<String> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| {
            let seconds = duration.as_secs();
            chrono_like(seconds)
        })
}

fn chrono_like(seconds: u64) -> String {
    let days = seconds / 86_400;
    let remainder = seconds % 86_400;
    let (year, month, day) = civil_from_days(days as i64);

    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        remainder / 3600,
        (remainder % 3600) / 60,
        remainder % 60
    )
}

fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;

    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn list_directory(
    grant: &DirectoryGrant,
    relative: &str,
) -> Result<LocalToolResult, LocalToolRefusal> {
    let path = resolve_existing(grant, relative)?;

    if !path.is_dir() {
        return Err(LocalToolRefusal::NotADirectory);
    }

    let mut entries: Vec<DirectoryEntry> = fs::read_dir(&path)
        .map_err(io)?
        .flatten()
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            let kind = if metadata.is_dir() {
                "directory"
            } else if metadata.is_file() {
                "file"
            } else {
                "other"
            };

            Some(DirectoryEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                kind,
                size: metadata.is_file().then_some(metadata.len()),
                modified_at: modified_at(&metadata),
            })
        })
        .collect();

    entries.sort_by(|left, right| {
        (right.kind == "directory")
            .cmp(&(left.kind == "directory"))
            .then(left.name.cmp(&right.name))
    });
    let truncated = entries.len() > MAX_LIST_ENTRIES;

    entries.truncate(MAX_LIST_ENTRIES);

    Ok(LocalToolResult::ListDirectory {
        path: display_path(grant, &path),
        entries,
        truncated,
    })
}

fn read_file(grant: &DirectoryGrant, relative: &str) -> Result<LocalToolResult, LocalToolRefusal> {
    let path = resolve_existing(grant, relative)?;
    let metadata = fs::metadata(&path).map_err(io)?;

    if !metadata.is_file() {
        return Err(LocalToolRefusal::NotAFile);
    }

    let bytes = fs::read(&path).map_err(io)?;
    let truncated = bytes.len() > MAX_READ_BYTES;
    let slice = &bytes[..bytes.len().min(MAX_READ_BYTES)];
    let content = std::str::from_utf8(slice)
        .map(str::to_string)
        .or_else(|_| String::from_utf8(slice.to_vec()).map_err(|_| LocalToolRefusal::NotText))?;

    if content.contains('\0') {
        return Err(LocalToolRefusal::NotText);
    }

    Ok(LocalToolResult::ReadFile {
        path: display_path(grant, &path),
        content,
        size: metadata.len(),
        truncated,
    })
}

fn search_files(
    grant: &DirectoryGrant,
    relative: &str,
    query: &str,
    contents: bool,
) -> Result<LocalToolResult, LocalToolRefusal> {
    let root = resolve_existing(grant, relative)?;

    if !root.is_dir() {
        return Err(LocalToolRefusal::NotADirectory);
    }

    let needle = query.to_lowercase();
    let mut matches = Vec::new();
    let mut pending = vec![root];
    let mut visited = 0usize;
    let mut truncated = false;

    while let Some(directory) = pending.pop() {
        let Ok(entries) = fs::read_dir(&directory) else {
            continue;
        };

        for entry in entries.flatten() {
            visited += 1;

            if visited > MAX_SEARCH_VISITS || matches.len() >= MAX_SEARCH_MATCHES {
                truncated = true;
                break;
            }

            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };

            if file_type.is_dir() {
                if !SKIPPED_DIRECTORIES.contains(&name.as_str()) {
                    pending.push(path);
                }

                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            if name.to_lowercase().contains(&needle) {
                matches.push(SearchMatch {
                    path: display_path(grant, &path),
                    line: None,
                    excerpt: None,
                });
                continue;
            }

            if !contents {
                continue;
            }

            let Ok(metadata) = entry.metadata() else {
                continue;
            };

            if metadata.len() > MAX_SEARCHED_FILE_BYTES {
                continue;
            }

            let Ok(text) = fs::read_to_string(&path) else {
                continue;
            };

            if let Some((index, line)) = text
                .lines()
                .enumerate()
                .find(|(_, line)| line.to_lowercase().contains(&needle))
            {
                matches.push(SearchMatch {
                    path: display_path(grant, &path),
                    line: Some(index + 1),
                    excerpt: Some(line.chars().take(200).collect()),
                });
            }
        }

        if truncated {
            break;
        }
    }

    Ok(LocalToolResult::SearchFiles { matches, truncated })
}

fn write_file(
    grant: &DirectoryGrant,
    relative: &str,
    content: &str,
    overwrite: bool,
) -> Result<LocalToolResult, LocalToolRefusal> {
    if content.len() > MAX_WRITE_BYTES {
        return Err(LocalToolRefusal::TooLarge);
    }

    let path = resolve_for_write(grant, relative)?;
    let existed = path.exists();

    if existed && !overwrite {
        return Err(LocalToolRefusal::AlreadyExists);
    }

    if existed && !path.is_file() {
        return Err(LocalToolRefusal::NotAFile);
    }

    fs::write(&path, content).map_err(io)?;

    Ok(LocalToolResult::WriteFile {
        path: display_path(grant, &path),
        bytes: content.len(),
        created: !existed,
    })
}

pub fn run_local_tool(
    grants: &DirectoryGrants,
    request: &LocalToolRequest,
) -> Result<LocalToolResult, LocalToolRefusal> {
    let grant = grants
        .get(&request.directory_id)
        .map_err(|_| LocalToolRefusal::UnknownDirectory)?;

    match &request.input {
        LocalToolInput::ListDirectory { path } => list_directory(&grant, path),
        LocalToolInput::ReadFile { path } => read_file(&grant, path),
        LocalToolInput::SearchFiles {
            query,
            path,
            contents,
        } => search_files(&grant, path, query, *contents),
        LocalToolInput::WriteFile {
            path,
            content,
            overwrite,
        } => write_file(&grant, path, content, *overwrite),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn grant(root: &Path) -> DirectoryGrant {
        DirectoryGrant {
            id: "directory-test".to_string(),
            path: root.canonicalize().expect("canonical root"),
            label: "test".to_string(),
            approved_at: "2026-10-19T00:00:00Z".to_string(),
            last_used_at: None,
            is_git_repo: false,
        }
    }

    fn temp_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "polychat-local-tools-{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ));

        fs::create_dir_all(root.join("notes")).expect("root");
        fs::write(root.join("notes/todo.md"), "buy milk\ncall mum\n").expect("file");
        root
    }

    #[test]
    fn refuses_paths_that_climb_out_of_the_grant() {
        let root = temp_root();
        let grant = grant(&root);

        assert_eq!(
            read_file(&grant, "../etc/passwd").unwrap_err(),
            LocalToolRefusal::PathOutsideGrant
        );
        assert_eq!(
            read_file(&grant, "/etc/passwd").unwrap_err(),
            LocalToolRefusal::PathOutsideGrant
        );
        assert_eq!(
            write_file(&grant, "../escape.txt", "x", false).unwrap_err(),
            LocalToolRefusal::PathOutsideGrant
        );
    }

    #[cfg(unix)]
    #[test]
    fn refuses_symlinks_that_lead_out_of_the_grant() {
        let root = temp_root();
        let outside = temp_root();
        let grant = grant(&root);

        std::os::unix::fs::symlink(outside.join("notes"), root.join("linked")).expect("dir link");
        std::os::unix::fs::symlink(outside.join("notes/todo.md"), root.join("todo-link.md"))
            .expect("file link");
        std::os::unix::fs::symlink(outside.join("missing.md"), root.join("dangling.md"))
            .expect("dangling link");

        assert_eq!(
            read_file(&grant, "linked/todo.md").unwrap_err(),
            LocalToolRefusal::PathOutsideGrant
        );
        assert_eq!(
            write_file(&grant, "linked/new.md", "x", false).unwrap_err(),
            LocalToolRefusal::PathOutsideGrant
        );
        assert_eq!(
            write_file(&grant, "todo-link.md", "x", true).unwrap_err(),
            LocalToolRefusal::PathOutsideGrant
        );
        assert_eq!(
            write_file(&grant, "dangling.md", "x", false).unwrap_err(),
            LocalToolRefusal::PathOutsideGrant
        );
        assert!(!outside.join("missing.md").exists());
    }

    #[test]
    fn lists_reads_searches_and_writes_inside_the_grant() {
        let root = temp_root();
        let grant = grant(&root);

        match list_directory(&grant, "notes").expect("list") {
            LocalToolResult::ListDirectory { entries, .. } => {
                assert_eq!(entries.len(), 1);
                assert_eq!(entries[0].name, "todo.md");
            }
            _ => panic!("wrong result"),
        }

        match read_file(&grant, "notes/todo.md").expect("read") {
            LocalToolResult::ReadFile { content, .. } => assert!(content.contains("call mum")),
            _ => panic!("wrong result"),
        }

        match search_files(&grant, "", "mum", true).expect("search") {
            LocalToolResult::SearchFiles { matches, .. } => {
                assert_eq!(matches.len(), 1);
                assert_eq!(matches[0].line, Some(2));
            }
            _ => panic!("wrong result"),
        }

        assert_eq!(
            write_file(&grant, "notes/todo.md", "replaced", false).unwrap_err(),
            LocalToolRefusal::AlreadyExists
        );

        match write_file(&grant, "notes/new.md", "hello", false).expect("write") {
            LocalToolResult::WriteFile { created, bytes, .. } => {
                assert!(created);
                assert_eq!(bytes, 5);
            }
            _ => panic!("wrong result"),
        }
    }
}
