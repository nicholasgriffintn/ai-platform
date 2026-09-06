use serde::Serialize;
use serde_json::{json, Value};

use crate::egress::DesktopEndpoint;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSession {
    pub endpoint_id: String,
    pub native_id: String,
    pub title: Option<String>,
    pub origin: Option<String>,
    pub state: String,
    pub executing_host: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentApprovalRequest {
    pub id: String,
    pub session_native_id: String,
    pub kind: String,
    pub summary: String,
    pub detail: Option<String>,
    pub executing_host: String,
    pub requested_at: String,
}

pub fn sessions_path(endpoint: &DesktopEndpoint) -> &'static str {
    match endpoint.vendor.as_str() {
        "hermes" => "/api/sessions",
        _ => "/api/v1/sessions",
    }
}

fn encode_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | '~') {
                character.to_string()
            } else {
                character
                    .to_string()
                    .as_bytes()
                    .iter()
                    .map(|byte| format!("%{byte:02X}"))
                    .collect()
            }
        })
        .collect()
}

pub fn prompt_path(endpoint: &DesktopEndpoint, session_native_id: &str) -> String {
    let session = encode_segment(session_native_id);

    match endpoint.vendor.as_str() {
        "hermes" => format!("/api/sessions/{session}/messages"),
        _ => format!("/api/v1/sessions/{session}/messages"),
    }
}

pub fn decision_path(endpoint: &DesktopEndpoint, request_id: &str) -> String {
    let request = encode_segment(request_id);

    match endpoint.vendor.as_str() {
        "hermes" => format!("/api/approvals/{request}"),
        _ => format!("/api/v1/approvals/{request}"),
    }
}

pub fn prompt_body(prompt: &str) -> Value {
    json!({ "message": prompt, "stream": true })
}

pub fn decision_body(approved: bool) -> Value {
    json!({ "decision": if approved { "approve" } else { "deny" } })
}

fn read_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str))
        .map(str::to_string)
}

fn session_state(value: &Value) -> String {
    let raw = read_string(value, &["state", "status"]).unwrap_or_default();

    match raw.as_str() {
        "running" | "active" | "busy" => "running".to_string(),
        "awaiting-approval" | "awaiting_approval" | "blocked" | "waiting" => {
            "awaiting-approval".to_string()
        }
        "failed" | "error" => "failed".to_string(),
        _ => "idle".to_string(),
    }
}

fn entries(body: &Value) -> Vec<&Value> {
    for key in ["sessions", "data", "items"] {
        if let Some(list) = body.get(key).and_then(Value::as_array) {
            return list.iter().collect();
        }
    }

    body.as_array()
        .map(|list| list.iter().collect())
        .unwrap_or_default()
}

pub fn parse_sessions(
    endpoint: &DesktopEndpoint,
    body: &Value,
    fallback_host: &str,
) -> Vec<AgentSession> {
    entries(body)
        .into_iter()
        .filter_map(|entry| {
            let native_id = read_string(entry, &["id", "sessionId", "session_id"])?;

            Some(AgentSession {
                endpoint_id: endpoint.id.clone(),
                native_id,
                title: read_string(entry, &["title", "name", "summary"]),
                origin: read_string(entry, &["channel", "origin", "source"]),
                state: session_state(entry),
                executing_host: read_string(entry, &["host", "machine"])
                    .unwrap_or_else(|| fallback_host.to_string()),
                updated_at: read_string(entry, &["updatedAt", "updated_at", "lastActiveAt"])
                    .unwrap_or_default(),
            })
        })
        .collect()
}

fn approval_kind(value: &Value) -> String {
    let raw = read_string(value, &["kind", "type", "action"]).unwrap_or_default();

    match raw.as_str() {
        "command" | "exec" | "shell" | "bash" => "command".to_string(),
        "file-write" | "file_write" | "write" | "edit" => "file-write".to_string(),
        "network" | "fetch" | "http" => "network".to_string(),
        "tool" | "tool_call" => "tool".to_string(),
        _ => "unknown".to_string(),
    }
}

pub fn parse_approval(
    value: &Value,
    session_native_id: &str,
    fallback_host: &str,
) -> Option<AgentApprovalRequest> {
    let id = read_string(value, &["id", "requestId", "request_id"])?;
    let summary = read_string(value, &["summary", "title", "description", "command"])
        .unwrap_or_else(|| "This agent wants to do something.".to_string());

    Some(AgentApprovalRequest {
        id,
        session_native_id: session_native_id.to_string(),
        kind: approval_kind(value),
        summary,
        detail: read_string(value, &["detail", "details", "body", "command"]),
        executing_host: read_string(value, &["host", "machine"])
            .unwrap_or_else(|| fallback_host.to_string()),
        requested_at: read_string(value, &["requestedAt", "requested_at", "createdAt"])
            .unwrap_or_default(),
    })
}

pub enum AgentChunk {
    Text(String),
    Approval(AgentApprovalRequest),
    Done,
    Ignored,
}

pub fn parse_agent_line(line: &str, session_native_id: &str, fallback_host: &str) -> AgentChunk {
    let trimmed = line.trim();
    let payload = trimmed.strip_prefix("data:").unwrap_or(trimmed).trim();

    if payload.is_empty() {
        return AgentChunk::Ignored;
    }

    if payload == "[DONE]" {
        return AgentChunk::Done;
    }

    let Ok(value) = serde_json::from_str::<Value>(payload) else {
        return AgentChunk::Ignored;
    };

    let event = read_string(&value, &["type", "event"]).unwrap_or_default();

    if event == "approval_request"
        || event == "permission_request"
        || value.get("approval").is_some()
    {
        let source = value.get("approval").unwrap_or(&value);

        if let Some(request) = parse_approval(source, session_native_id, fallback_host) {
            return AgentChunk::Approval(request);
        }
    }

    if matches!(
        event.as_str(),
        "done" | "complete" | "session_idle" | "message_stop"
    ) {
        return AgentChunk::Done;
    }

    let text = read_string(&value, &["text", "content", "delta", "message"]).unwrap_or_default();

    if text.is_empty() {
        AgentChunk::Ignored
    } else {
        AgentChunk::Text(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::egress::{EndpointKind, EndpointTransport};

    fn endpoint(vendor: &str) -> DesktopEndpoint {
        DesktopEndpoint {
            id: "gateway-1".to_string(),
            kind: EndpointKind::Agent,
            vendor: vendor.to_string(),
            label: "Gateway".to_string(),
            url: "http://127.0.0.1:18789".to_string(),
            transport: EndpointTransport::Loopback,
            pairing_secret_stored: false,
            approved_at: "1970-01-01T00:00:00Z".to_string(),
            last_seen_at: None,
        }
    }

    #[test]
    fn reads_sessions_from_whichever_envelope_a_gateway_uses() {
        let wrapped =
            json!({ "sessions": [{ "id": "s1", "title": "Deploy", "state": "running" }] });
        let bare = json!([{ "session_id": "s2", "status": "blocked" }]);

        let first = parse_sessions(&endpoint("openclaw"), &wrapped, "nest.local");
        let second = parse_sessions(&endpoint("hermes"), &bare, "nest.local");

        assert_eq!(first.len(), 1);
        assert_eq!(first[0].native_id, "s1");
        assert_eq!(first[0].state, "running");
        assert_eq!(second[0].native_id, "s2");
        assert_eq!(second[0].state, "awaiting-approval");
    }

    #[test]
    fn reports_the_machine_that_would_execute_when_the_gateway_does_not_say() {
        let body = json!({ "sessions": [{ "id": "s1" }] });

        let sessions = parse_sessions(&endpoint("openclaw"), &body, "nest.local");

        assert_eq!(sessions[0].executing_host, "nest.local");
        assert_eq!(sessions[0].state, "idle");
    }

    #[test]
    fn ignores_a_session_entry_with_no_identity() {
        let body = json!({ "sessions": [{ "title": "no id" }] });

        assert!(parse_sessions(&endpoint("openclaw"), &body, "nest.local").is_empty());
    }

    #[test]
    fn recognises_an_approval_request_and_what_it_would_do() {
        let line = r#"data: {"type":"approval_request","id":"a1","kind":"shell","summary":"Run tests","detail":"pnpm test"}"#;

        match parse_agent_line(line, "s1", "nest.local") {
            AgentChunk::Approval(request) => {
                assert_eq!(request.id, "a1");
                assert_eq!(request.kind, "command");
                assert_eq!(request.session_native_id, "s1");
                assert_eq!(request.executing_host, "nest.local");
            }
            _ => panic!("expected an approval request"),
        }
    }

    #[test]
    fn treats_an_unrecognised_approval_kind_as_unknown_rather_than_safe() {
        let line = r#"data: {"type":"approval_request","id":"a1","kind":"teleport"}"#;

        match parse_agent_line(line, "s1", "nest.local") {
            AgentChunk::Approval(request) => assert_eq!(request.kind, "unknown"),
            _ => panic!("expected an approval request"),
        }
    }

    #[test]
    fn reads_agent_text_and_completion() {
        assert!(matches!(
            parse_agent_line(r#"data: {"type":"delta","text":"Hel"}"#, "s1", "h"),
            AgentChunk::Text(text) if text == "Hel"
        ));
        assert!(matches!(
            parse_agent_line(r#"data: {"type":"done"}"#, "s1", "h"),
            AgentChunk::Done
        ));
        assert!(matches!(
            parse_agent_line("data: [DONE]", "s1", "h"),
            AgentChunk::Done
        ));
        assert!(matches!(
            parse_agent_line(": keep-alive", "s1", "h"),
            AgentChunk::Ignored
        ));
    }

    #[test]
    fn asks_each_vendor_at_its_own_paths() {
        assert_eq!(sessions_path(&endpoint("openclaw")), "/api/v1/sessions");
        assert_eq!(sessions_path(&endpoint("hermes")), "/api/sessions");
        assert_eq!(
            prompt_path(&endpoint("hermes"), "s1"),
            "/api/sessions/s1/messages"
        );
        assert_eq!(
            decision_path(&endpoint("openclaw"), "a1"),
            "/api/v1/approvals/a1"
        );
    }

    #[test]
    fn refuses_to_let_a_gateway_steer_the_path_with_its_own_identifiers() {
        let gateway = endpoint("openclaw");

        assert_eq!(
            prompt_path(&gateway, "../../admin"),
            "/api/v1/sessions/..%2F..%2Fadmin/messages"
        );
        assert_eq!(
            decision_path(&gateway, "..%2f..%2fadmin"),
            "/api/v1/approvals/..%252f..%252fadmin"
        );
        assert_eq!(
            prompt_path(&gateway, "a b?c#d"),
            "/api/v1/sessions/a%20b%3Fc%23d/messages"
        );
    }
    #[test]
    fn sends_a_decision_that_says_which_way_it_went() {
        assert_eq!(decision_body(true)["decision"], json!("approve"));
        assert_eq!(decision_body(false)["decision"], json!("deny"));
    }
}
