use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde_json::Value;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::digest::{DigestItem, ReadingWindow, LINE_LENGTH};
use super::settings::{AgentSettings, NeverShareKey};
use crate::text::{clip, plural};

const SESSION_LIMIT: usize = 40;
const PROMPT_LENGTH: usize = 100;
const CODEX_DEPTH: usize = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AgentTool {
    ClaudeCode,
    Codex,
}

impl AgentTool {
    fn label(self) -> &'static str {
        match self {
            AgentTool::ClaudeCode => "Claude Code",
            AgentTool::Codex => "Codex",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AgentSession {
    pub tool: AgentTool,
    pub project: String,
    pub branch: Option<String>,
    pub title: Option<String>,
    pub prompts: usize,
    pub first_prompt: Option<String>,
    pub last_at: i64,
}

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn parse_time(value: Option<&Value>) -> Option<i64> {
    let text = value?.as_str()?;

    OffsetDateTime::parse(text, &Rfc3339)
        .ok()
        .map(OffsetDateTime::unix_timestamp)
}

fn project_name(cwd: &str) -> String {
    Path::new(cwd)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or(cwd)
        .to_string()
}

fn usable_branch(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|branch| !branch.is_empty() && *branch != "HEAD")
        .map(str::to_string)
}

fn is_typed_prompt(text: &str) -> bool {
    let text = text.trim();

    !text.is_empty() && !text.starts_with('<')
}

fn claude_prompt(message: &Value) -> Option<String> {
    match message.get("content")? {
        Value::String(text) => is_typed_prompt(text).then(|| text.trim().to_string()),
        Value::Array(parts) => {
            if parts
                .iter()
                .any(|part| part.get("type").and_then(Value::as_str) == Some("tool_result"))
            {
                return None;
            }

            parts
                .iter()
                .filter(|part| part.get("type").and_then(Value::as_str) == Some("text"))
                .filter_map(|part| part.get("text").and_then(Value::as_str))
                .find(|text| is_typed_prompt(text))
                .map(|text| text.trim().to_string())
        }
        _ => None,
    }
}

#[derive(Default)]
struct SessionReading {
    project: Option<String>,
    branch: Option<String>,
    title: Option<String>,
    prompts: usize,
    first_prompt: Option<String>,
    last_at: Option<i64>,
}

impl SessionReading {
    fn count_prompt(&mut self, prompt: String, at: i64) {
        self.prompts += 1;
        self.first_prompt.get_or_insert(prompt);
        self.last_at = Some(self.last_at.map_or(at, |last| last.max(at)));
    }

    fn finish(self, tool: AgentTool) -> Option<AgentSession> {
        (self.prompts > 0).then(|| AgentSession {
            tool,
            project: self.project.unwrap_or_else(|| "a folder".to_string()),
            branch: self.branch,
            title: self.title,
            prompts: self.prompts,
            first_prompt: self.first_prompt,
            last_at: self.last_at.unwrap_or_default(),
        })
    }
}

pub fn parse_claude_session(
    reader: impl BufRead,
    window: &ReadingWindow<'_>,
) -> Option<AgentSession> {
    let mut reading = SessionReading::default();

    for line in reader.lines().map_while(Result::ok) {
        let wanted = line.contains("\"type\":\"user\"")
            || line.contains("\"type\":\"custom-title\"")
            || line.contains("\"type\":\"summary\"");

        if !wanted {
            continue;
        }

        let Ok(entry) = serde_json::from_str::<Value>(&line) else {
            continue;
        };

        match entry.get("type").and_then(Value::as_str) {
            Some("custom-title") => {
                if let Some(title) = entry.get("customTitle").and_then(Value::as_str) {
                    reading.title = Some(title.trim().to_string());
                }
            }
            Some("summary") => {
                if reading.title.is_none() {
                    reading.title = entry
                        .get("summary")
                        .and_then(Value::as_str)
                        .map(|summary| summary.trim().to_string());
                }
            }
            Some("user") => {
                if entry.get("isSidechain").and_then(Value::as_bool) == Some(true)
                    || entry.get("isMeta").and_then(Value::as_bool) == Some(true)
                {
                    continue;
                }

                if let Some(cwd) = entry.get("cwd").and_then(Value::as_str) {
                    reading.project = Some(project_name(cwd));
                }

                if let Some(branch) = usable_branch(entry.get("gitBranch")) {
                    reading.branch = Some(branch);
                }

                let Some(at) = parse_time(entry.get("timestamp")) else {
                    continue;
                };

                if !window.admits(at) {
                    continue;
                }

                if let Some(prompt) = entry.get("message").and_then(claude_prompt) {
                    reading.count_prompt(prompt, at);
                }
            }
            _ => {}
        }
    }

    reading.finish(AgentTool::ClaudeCode)
}

fn codex_prompt(payload: &Value) -> Option<String> {
    if payload.get("type").and_then(Value::as_str) != Some("message")
        || payload.get("role").and_then(Value::as_str) != Some("user")
    {
        return None;
    }

    payload
        .get("content")?
        .as_array()?
        .iter()
        .filter(|part| part.get("type").and_then(Value::as_str) == Some("input_text"))
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .find(|text| is_typed_prompt(text))
        .map(|text| text.trim().to_string())
}

pub fn parse_codex_session(
    reader: impl BufRead,
    titles: &HashMap<String, String>,
    window: &ReadingWindow<'_>,
) -> Option<AgentSession> {
    let mut reading = SessionReading::default();

    for line in reader.lines().map_while(Result::ok) {
        let wanted = line.contains("\"type\":\"session_meta\"")
            || (line.contains("\"type\":\"response_item\"") && line.contains("\"role\":\"user\""));

        if !wanted {
            continue;
        }

        let Ok(entry) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let Some(payload) = entry.get("payload") else {
            continue;
        };

        match entry.get("type").and_then(Value::as_str) {
            Some("session_meta") => {
                if let Some(cwd) = payload.get("cwd").and_then(Value::as_str) {
                    reading.project = Some(project_name(cwd));
                }

                reading.branch = usable_branch(payload.pointer("/git/branch"));
                reading.title = payload
                    .get("id")
                    .and_then(Value::as_str)
                    .and_then(|id| titles.get(id))
                    .cloned();
            }
            Some("response_item") => {
                let Some(at) = parse_time(entry.get("timestamp")) else {
                    continue;
                };

                if !window.admits(at) {
                    continue;
                }

                if let Some(prompt) = codex_prompt(payload) {
                    reading.count_prompt(prompt, at);
                }
            }
            _ => {}
        }
    }

    reading.finish(AgentTool::Codex)
}

fn modified_since(path: &Path, since: i64) -> bool {
    std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .is_some_and(|elapsed| elapsed.as_secs() as i64 >= since)
}

fn transcript_files(directory: &Path, depth: usize, since: i64, found: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(kind) = entry.file_type() else {
            continue;
        };

        if kind.is_dir() && depth > 0 {
            transcript_files(&path, depth - 1, since, found);
        } else if kind.is_file()
            && path.extension().and_then(|extension| extension.to_str()) == Some("jsonl")
            && modified_since(&path, since)
        {
            found.push(path);
        }
    }
}

fn read_sessions(
    files: Vec<PathBuf>,
    parse: impl Fn(BufReader<File>) -> Option<AgentSession>,
) -> Vec<AgentSession> {
    files
        .into_iter()
        .filter_map(|path| File::open(path).ok())
        .filter_map(|file| parse(BufReader::new(file)))
        .collect()
}

pub fn read_claude_sessions(window: &ReadingWindow<'_>) -> Vec<AgentSession> {
    let Some(projects) = home().map(|home| home.join(".claude/projects")) else {
        return Vec::new();
    };
    let mut files = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&projects) {
        for project in entries.flatten() {
            transcript_files(&project.path(), 0, window.start, &mut files);
        }
    }

    read_sessions(files, |reader| parse_claude_session(reader, window))
}

fn read_codex_titles(index: &Path) -> HashMap<String, String> {
    let Ok(file) = File::open(index) else {
        return HashMap::new();
    };

    BufReader::new(file)
        .lines()
        .map_while(Result::ok)
        .filter_map(|line| serde_json::from_str::<Value>(&line).ok())
        .filter_map(|entry| {
            let id = entry.get("id")?.as_str()?.to_string();
            let name = entry.get("thread_name")?.as_str()?.trim().to_string();

            (!name.is_empty()).then_some((id, name))
        })
        .collect()
}

pub fn read_codex_sessions(window: &ReadingWindow<'_>) -> Vec<AgentSession> {
    let Some(codex) = home().map(|home| home.join(".codex")) else {
        return Vec::new();
    };
    let titles = read_codex_titles(&codex.join("session_index.jsonl"));
    let mut files = Vec::new();

    transcript_files(
        &codex.join("sessions"),
        CODEX_DEPTH,
        window.start,
        &mut files,
    );

    read_sessions(files, |reader| parse_codex_session(reader, &titles, window))
}

pub fn digest_agents(
    mut sessions: Vec<AgentSession>,
    settings: &AgentSettings,
    never_shared: &[String],
) -> Vec<DigestItem> {
    sessions.retain(|session| !never_shared.contains(&session.project.to_lowercase()));
    sessions.sort_by_key(|session| std::cmp::Reverse(session.last_at));

    sessions
        .into_iter()
        .take(SESSION_LIMIT)
        .map(|session| {
            let place = match &session.branch {
                Some(branch) => format!("{} ({branch})", session.project),
                None => session.project.clone(),
            };
            let title = session
                .title
                .clone()
                .filter(|title| !title.is_empty())
                .unwrap_or_else(|| "untitled session".to_string());
            let mut line = format!(
                "{place} · {title} · {} in {}",
                plural(session.prompts, "prompt", "prompts"),
                session.tool.label()
            );

            if settings.prompts {
                if let Some(prompt) = &session.first_prompt {
                    line.push_str(&format!(" · “{}”", clip(prompt, PROMPT_LENGTH)));
                }
            }

            DigestItem {
                line: clip(&line, LINE_LENGTH),
                never_share: Some(NeverShareKey::Project(session.project.to_lowercase())),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const WINDOW: ReadingWindow<'static> = ReadingWindow {
        start: 1_792_000_000,
        end: 1_793_000_000,
        pauses: &[],
    };

    #[test]
    fn counts_typed_prompts_in_a_claude_session_and_ignores_tool_results() {
        let transcript = [
            r#"{"type":"user","timestamp":"2026-10-24T10:00:00Z","cwd":"/Users/me/assistant","gitBranch":"main","message":{"role":"user","content":"Fix the tray menu"}}"#,
            r#"{"type":"user","timestamp":"2026-10-24T10:01:00Z","cwd":"/Users/me/assistant","message":{"role":"user","content":[{"type":"tool_result","content":"ok"}]}}"#,
            r#"{"type":"user","timestamp":"2026-10-24T10:02:00Z","cwd":"/Users/me/assistant","message":{"role":"user","content":"<command-name>/clear</command-name>"}}"#,
            r#"{"type":"user","isSidechain":true,"timestamp":"2026-10-24T10:03:00Z","message":{"role":"user","content":"Subagent brief"}}"#,
            r#"{"type":"user","timestamp":"2026-10-24T10:04:00Z","cwd":"/Users/me/assistant","message":{"role":"user","content":"Now the settings tab"}}"#,
            r#"{"type":"custom-title","customTitle":"Tray pause controls","sessionId":"s1"}"#,
            "{\"type\":\"user\",\"truncated",
        ]
        .join("\n");
        let session = parse_claude_session(transcript.as_bytes(), &WINDOW).expect("a session");

        assert_eq!(session.project, "assistant");
        assert_eq!(session.branch.as_deref(), Some("main"));
        assert_eq!(session.title.as_deref(), Some("Tray pause controls"));
        assert_eq!(session.prompts, 2);
        assert_eq!(session.first_prompt.as_deref(), Some("Fix the tray menu"));
    }

    #[test]
    fn reads_a_codex_session_title_from_the_index_and_skips_injected_context() {
        let transcript = [
            r#"{"timestamp":"2026-10-24T09:00:00Z","type":"session_meta","payload":{"id":"t1","cwd":"/Users/me/site","git":{"branch":"feature"}}}"#,
            r#"{"timestamp":"2026-10-24T09:00:01Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<environment_context>cwd</environment_context>"}]}}"#,
            r#"{"timestamp":"2026-10-24T09:00:02Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Add a sitemap"}]}}"#,
        ]
        .join("\n");
        let titles = HashMap::from([("t1".to_string(), "Sitemap work".to_string())]);
        let session =
            parse_codex_session(transcript.as_bytes(), &titles, &WINDOW).expect("a session");

        assert_eq!(session.project, "site");
        assert_eq!(session.branch.as_deref(), Some("feature"));
        assert_eq!(session.title.as_deref(), Some("Sitemap work"));
        assert_eq!(session.prompts, 1);
    }

    #[test]
    fn leaves_out_sessions_with_no_prompts_in_the_window() {
        let transcript = r#"{"type":"user","timestamp":"2020-01-01T00:00:00Z","cwd":"/x/old","message":{"role":"user","content":"Old work"}}"#;

        assert!(parse_claude_session(transcript.as_bytes(), &WINDOW).is_none());
    }

    #[test]
    fn sends_first_prompts_only_when_asked_and_drops_never_shared_projects() {
        let session = AgentSession {
            tool: AgentTool::Codex,
            project: "site".to_string(),
            branch: None,
            title: None,
            prompts: 1,
            first_prompt: Some("Add a sitemap".to_string()),
            last_at: 1,
        };
        let quiet = digest_agents(vec![session.clone()], &AgentSettings::default(), &[]);

        assert_eq!(quiet[0].line, "site · untitled session · 1 prompt in Codex");

        let chatty = AgentSettings {
            prompts: true,
            ..AgentSettings::default()
        };
        assert!(digest_agents(vec![session.clone()], &chatty, &[])[0]
            .line
            .ends_with("“Add a sitemap”"));
        assert!(digest_agents(vec![session], &chatty, &["site".to_string()]).is_empty());
    }
}
