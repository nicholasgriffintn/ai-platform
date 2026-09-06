use serde::Serialize;
use serde_json::Value;

use crate::egress::DesktopEndpoint;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelCapabilities {
    pub tools: bool,
    pub vision: bool,
    pub thinking: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredModel {
    pub endpoint_id: String,
    pub native_id: String,
    pub display_name: String,
    pub context_tokens: Option<u32>,
    pub parameter_size_bytes: Option<u64>,
    pub capabilities: ModelCapabilities,
    pub loaded: bool,
    pub discovered_at: String,
}

pub fn models_path(endpoint: &DesktopEndpoint) -> &'static str {
    match endpoint.vendor.as_str() {
        "lmstudio" => "/api/v0/models",
        "llamacpp" => "/v1/models",
        _ => "/api/tags",
    }
}

pub fn parse_models(
    endpoint: &DesktopEndpoint,
    body: &Value,
    discovered_at: &str,
) -> Vec<DiscoveredModel> {
    match endpoint.vendor.as_str() {
        "lmstudio" => parse_lmstudio(&endpoint.id, body, discovered_at),
        "llamacpp" => parse_openai_models(&endpoint.id, body, discovered_at),
        _ => parse_ollama(&endpoint.id, body, discovered_at),
    }
}

fn parse_ollama(endpoint_id: &str, body: &Value, discovered_at: &str) -> Vec<DiscoveredModel> {
    let Some(entries) = body.get("models").and_then(Value::as_array) else {
        return Vec::new();
    };

    entries
        .iter()
        .filter_map(|entry| {
            let native_id = entry.get("model").or_else(|| entry.get("name"))?.as_str()?;
            let details = entry.get("details");
            let families = details
                .and_then(|details| details.get("families"))
                .and_then(Value::as_array)
                .map(|families| {
                    families
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_lowercase)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            Some(DiscoveredModel {
                endpoint_id: endpoint_id.to_string(),
                native_id: native_id.to_string(),
                display_name: native_id.to_string(),
                context_tokens: None,
                parameter_size_bytes: entry.get("size").and_then(Value::as_u64),
                capabilities: ModelCapabilities {
                    tools: false,
                    vision: families.iter().any(|family| is_vision_family(family)),
                    thinking: false,
                },
                loaded: false,
                discovered_at: discovered_at.to_string(),
            })
        })
        .collect()
}

fn parse_openai_models(
    endpoint_id: &str,
    body: &Value,
    discovered_at: &str,
) -> Vec<DiscoveredModel> {
    let Some(entries) = body.get("data").and_then(Value::as_array) else {
        return Vec::new();
    };

    entries
        .iter()
        .filter_map(|entry| {
            let native_id = entry.get("id")?.as_str()?;

            Some(DiscoveredModel {
                endpoint_id: endpoint_id.to_string(),
                native_id: native_id.to_string(),
                display_name: native_id.to_string(),
                context_tokens: entry
                    .get("meta")
                    .and_then(|meta| meta.get("n_ctx_train"))
                    .and_then(Value::as_u64)
                    .and_then(|value| u32::try_from(value).ok()),
                parameter_size_bytes: entry
                    .get("meta")
                    .and_then(|meta| meta.get("size"))
                    .and_then(Value::as_u64),
                capabilities: ModelCapabilities {
                    tools: false,
                    vision: false,
                    thinking: false,
                },
                loaded: true,
                discovered_at: discovered_at.to_string(),
            })
        })
        .collect()
}

fn is_vision_family(family: &str) -> bool {
    family.contains("clip") || family.contains("vision") || family.contains("mllama")
}

fn parse_lmstudio(endpoint_id: &str, body: &Value, discovered_at: &str) -> Vec<DiscoveredModel> {
    let Some(entries) = body.get("data").and_then(Value::as_array) else {
        return Vec::new();
    };

    entries
        .iter()
        .filter_map(|entry| {
            let native_id = entry.get("id")?.as_str()?;
            let model_type = entry
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default();

            if model_type == "embeddings" {
                return None;
            }

            Some(DiscoveredModel {
                endpoint_id: endpoint_id.to_string(),
                native_id: native_id.to_string(),
                display_name: native_id.to_string(),
                context_tokens: entry
                    .get("max_context_length")
                    .and_then(Value::as_u64)
                    .and_then(|value| u32::try_from(value).ok()),
                parameter_size_bytes: None,
                capabilities: ModelCapabilities {
                    tools: false,
                    vision: model_type == "vlm",
                    thinking: false,
                },
                loaded: entry.get("state").and_then(Value::as_str) == Some("loaded"),
                discovered_at: discovered_at.to_string(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

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

    #[test]
    fn reads_installed_ollama_models_with_their_size() {
        let body = json!({
            "models": [
                {
                    "name": "gpt-oss:20b",
                    "model": "gpt-oss:20b",
                    "size": 13_780_173_724_u64,
                    "details": { "families": ["gptoss"] }
                },
                {
                    "name": "llama3.2-vision:11b",
                    "model": "llama3.2-vision:11b",
                    "size": 7_816_589_186_u64,
                    "details": { "families": ["mllama", "mllama"] }
                }
            ]
        });

        let models = parse_models(&endpoint("ollama"), &body, "2026-09-06T09:00:00Z");

        assert_eq!(models.len(), 2);
        assert_eq!(models[0].native_id, "gpt-oss:20b");
        assert_eq!(models[0].parameter_size_bytes, Some(13_780_173_724));
        assert!(!models[0].capabilities.vision);
        assert!(models[1].capabilities.vision);
    }

    #[test]
    fn reads_lmstudio_context_length_and_load_state() {
        let body = json!({
            "data": [
                {
                    "id": "qwen/qwen3-coder-30b",
                    "type": "llm",
                    "max_context_length": 262_144,
                    "state": "loaded"
                },
                {
                    "id": "google/gemma-3-12b",
                    "type": "vlm",
                    "max_context_length": 131_072,
                    "state": "not-loaded"
                },
                {
                    "id": "text-embedding-nomic",
                    "type": "embeddings",
                    "max_context_length": 2048,
                    "state": "not-loaded"
                }
            ]
        });

        let models = parse_models(&endpoint("lmstudio"), &body, "2026-09-06T09:00:00Z");

        assert_eq!(models.len(), 2);
        assert_eq!(models[0].context_tokens, Some(262_144));
        assert!(models[0].loaded);
        assert!(models[1].capabilities.vision);
        assert!(!models[1].loaded);
    }

    #[test]
    fn reads_llama_cpp_models_from_its_openai_listing() {
        let body = json!({
            "data": [
                { "id": "qwen3-8b.gguf", "meta": { "n_ctx_train": 32_768, "size": 5_000_000_000_u64 } },
                { "id": "no-meta.gguf" }
            ]
        });

        let models = parse_models(&endpoint("llamacpp"), &body, "2026-09-06T09:00:00Z");

        assert_eq!(models.len(), 2);
        assert_eq!(models[0].context_tokens, Some(32_768));
        assert_eq!(models[0].parameter_size_bytes, Some(5_000_000_000));
        assert!(models[0].loaded);
        assert_eq!(models[1].context_tokens, None);
    }

    #[test]
    fn returns_nothing_when_a_runtime_answers_with_an_unexpected_shape() {
        let body = json!({ "error": "not found" });

        assert!(parse_models(&endpoint("ollama"), &body, "2026-09-06T09:00:00Z").is_empty());
        assert!(parse_models(&endpoint("lmstudio"), &body, "2026-09-06T09:00:00Z").is_empty());
    }

    #[test]
    fn asks_each_vendor_for_models_at_its_own_path() {
        assert_eq!(models_path(&endpoint("ollama")), "/api/tags");
        assert_eq!(models_path(&endpoint("lmstudio")), "/api/v0/models");
        assert_eq!(models_path(&endpoint("llamacpp")), "/v1/models");
    }
}
