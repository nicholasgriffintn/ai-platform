use serde::Deserialize;
use serde_json::{json, Value};

use crate::egress::DesktopEndpoint;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRunRequest {
    pub endpoint_id: String,
    pub native_model_id: String,
    pub messages: Vec<ChatMessage>,
    pub max_output_tokens: Option<u32>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum StreamChunk {
    Text(String),
    Done,
    Ignored,
}

pub fn chat_path(endpoint: &DesktopEndpoint) -> &'static str {
    match endpoint.vendor.as_str() {
        "lmstudio" | "llamacpp" => "/v1/chat/completions",
        _ => "/api/chat",
    }
}

pub fn chat_body(endpoint: &DesktopEndpoint, request: &ModelRunRequest) -> Value {
    let messages: Vec<Value> = request
        .messages
        .iter()
        .map(|message| json!({ "role": message.role, "content": message.content }))
        .collect();

    match endpoint.vendor.as_str() {
        "lmstudio" | "llamacpp" => {
            let mut body = json!({
                "model": request.native_model_id,
                "messages": messages,
                "stream": true,
            });

            if let Some(limit) = request.max_output_tokens {
                body["max_tokens"] = json!(limit);
            }

            body
        }
        _ => {
            let mut body = json!({
                "model": request.native_model_id,
                "messages": messages,
                "stream": true,
            });

            if let Some(limit) = request.max_output_tokens {
                body["options"] = json!({ "num_predict": limit });
            }

            body
        }
    }
}

pub fn parse_stream_line(endpoint: &DesktopEndpoint, line: &str) -> StreamChunk {
    match endpoint.vendor.as_str() {
        "lmstudio" | "llamacpp" => parse_server_sent_line(line),
        _ => parse_newline_delimited_line(line),
    }
}

fn parse_newline_delimited_line(line: &str) -> StreamChunk {
    let trimmed = line.trim();

    if trimmed.is_empty() {
        return StreamChunk::Ignored;
    }

    let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
        return StreamChunk::Ignored;
    };

    let text = value
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .unwrap_or_default();

    if !text.is_empty() {
        return StreamChunk::Text(text.to_string());
    }

    if value.get("done").and_then(Value::as_bool) == Some(true) {
        return StreamChunk::Done;
    }

    StreamChunk::Ignored
}

fn parse_server_sent_line(line: &str) -> StreamChunk {
    let trimmed = line.trim();
    let Some(payload) = trimmed.strip_prefix("data:") else {
        return StreamChunk::Ignored;
    };

    let payload = payload.trim();

    if payload == "[DONE]" {
        return StreamChunk::Done;
    }

    let Ok(value) = serde_json::from_str::<Value>(payload) else {
        return StreamChunk::Ignored;
    };

    let text = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("delta"))
        .and_then(|delta| delta.get("content"))
        .and_then(Value::as_str)
        .unwrap_or_default();

    if text.is_empty() {
        StreamChunk::Ignored
    } else {
        StreamChunk::Text(text.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::egress::{EndpointKind, EndpointTransport};

    fn endpoint(vendor: &str) -> DesktopEndpoint {
        DesktopEndpoint {
            id: "endpoint-1".to_string(),
            kind: EndpointKind::Model,
            vendor: vendor.to_string(),
            label: "Test".to_string(),
            url: "http://127.0.0.1:11434".to_string(),
            transport: EndpointTransport::Loopback,
            pairing_secret_stored: false,
            approved_at: "1970-01-01T00:00:00Z".to_string(),
            last_seen_at: None,
        }
    }

    fn request() -> ModelRunRequest {
        ModelRunRequest {
            endpoint_id: "endpoint-1".to_string(),
            native_model_id: "gpt-oss:20b".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "hello".to_string(),
            }],
            max_output_tokens: Some(256),
        }
    }

    #[test]
    fn reads_ollama_content_and_completion() {
        let ollama = endpoint("ollama");

        assert_eq!(
            parse_stream_line(&ollama, r#"{"message":{"content":"Hel"},"done":false}"#),
            StreamChunk::Text("Hel".to_string())
        );
        assert_eq!(
            parse_stream_line(&ollama, r#"{"message":{"content":""},"done":true}"#),
            StreamChunk::Done
        );
        assert_eq!(parse_stream_line(&ollama, "   "), StreamChunk::Ignored);
        assert_eq!(parse_stream_line(&ollama, "not json"), StreamChunk::Ignored);
    }

    #[test]
    fn reads_server_sent_deltas_and_the_terminator() {
        let lmstudio = endpoint("lmstudio");

        assert_eq!(
            parse_stream_line(
                &lmstudio,
                r#"data: {"choices":[{"delta":{"content":"Hel"}}]}"#
            ),
            StreamChunk::Text("Hel".to_string())
        );
        assert_eq!(
            parse_stream_line(&lmstudio, "data: [DONE]"),
            StreamChunk::Done
        );
        assert_eq!(
            parse_stream_line(&lmstudio, r#"data: {"choices":[{"delta":{}}]}"#),
            StreamChunk::Ignored
        );
        assert_eq!(
            parse_stream_line(&lmstudio, ": keep-alive"),
            StreamChunk::Ignored
        );
    }

    #[test]
    fn asks_each_vendor_at_its_own_path_with_its_own_output_limit() {
        let ollama = endpoint("ollama");
        let lmstudio = endpoint("lmstudio");

        assert_eq!(chat_path(&ollama), "/api/chat");
        assert_eq!(chat_path(&lmstudio), "/v1/chat/completions");

        let ollama_body = chat_body(&ollama, &request());
        assert_eq!(ollama_body["stream"], json!(true));
        assert_eq!(ollama_body["options"]["num_predict"], json!(256));

        let lmstudio_body = chat_body(&lmstudio, &request());
        assert_eq!(lmstudio_body["max_tokens"], json!(256));
        assert_eq!(lmstudio_body["messages"][0]["content"], json!("hello"));
    }

    #[test]
    fn omits_an_output_limit_that_was_not_asked_for() {
        let mut unbounded = request();
        unbounded.max_output_tokens = None;

        assert!(chat_body(&endpoint("ollama"), &unbounded)
            .get("options")
            .is_none());
        assert!(chat_body(&endpoint("lmstudio"), &unbounded)
            .get("max_tokens")
            .is_none());
    }
}
