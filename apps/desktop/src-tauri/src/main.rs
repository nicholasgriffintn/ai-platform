#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod discovery;
mod egress;

use std::time::Duration;

use discovery::DiscoveredModel;
use egress::{DesktopEndpoint, EgressRefusal, EndpointKind, EndpointTransport};
use serde::Serialize;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use url::Url;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);
const DISCOVERY_TIMEOUT: Duration = Duration::from_secs(10);
const BUILT_IN_APPROVED_AT: &str = "1970-01-01T00:00:00Z";

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
enum Readiness {
    #[serde(rename_all = "camelCase")]
    Ready {
        checked_at: String,
        version: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Unreachable {
        checked_at: String,
        detail: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Unauthorised {
        checked_at: String,
        detail: Option<String>,
    },
}

fn timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| BUILT_IN_APPROVED_AT.to_string())
}

fn built_in_endpoint(id: &str, vendor: &str, label: &str, url: &str) -> DesktopEndpoint {
    DesktopEndpoint {
        id: id.to_string(),
        kind: EndpointKind::Model,
        vendor: vendor.to_string(),
        label: label.to_string(),
        url: url.to_string(),
        transport: EndpointTransport::Loopback,
        pairing_secret_stored: false,
        approved_at: BUILT_IN_APPROVED_AT.to_string(),
        last_seen_at: None,
    }
}

fn configured_endpoints() -> Vec<DesktopEndpoint> {
    vec![
        built_in_endpoint(
            "ollama-loopback",
            "ollama",
            "Ollama",
            "http://127.0.0.1:11434",
        ),
        built_in_endpoint(
            "lmstudio-loopback",
            "lmstudio",
            "LM Studio",
            "http://127.0.0.1:1234",
        ),
    ]
}

fn refusal_detail(refusal: EgressRefusal) -> String {
    match refusal {
        EgressRefusal::UnknownEndpoint => "This endpoint is not configured.".to_string(),
        EgressRefusal::Unparsable => "This endpoint address cannot be read.".to_string(),
        EgressRefusal::UnsupportedScheme => "This endpoint must use HTTP or HTTPS.".to_string(),
        EgressRefusal::LoopbackExpected => {
            "This endpoint claims loopback but addresses another host.".to_string()
        }
        EgressRefusal::UnprotectedAgentRuntime => {
            "This agent runtime needs HTTPS or a pairing secret before it can be reached."
                .to_string()
        }
    }
}

fn authorised_endpoint(endpoint_id: &str) -> Result<(DesktopEndpoint, Url), String> {
    let endpoints = configured_endpoints();
    let target = egress::resolve_target(&endpoints, endpoint_id).map_err(refusal_detail)?;
    let endpoint = endpoints
        .into_iter()
        .find(|candidate| candidate.id == endpoint_id)
        .ok_or_else(|| refusal_detail(EgressRefusal::UnknownEndpoint))?;

    Ok((endpoint, target))
}

fn http_client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|cause| cause.to_string())
}

#[tauri::command]
fn list_endpoints() -> Vec<DesktopEndpoint> {
    configured_endpoints()
}

#[tauri::command]
async fn probe_endpoint(endpoint_id: String) -> Readiness {
    let target = match authorised_endpoint(&endpoint_id) {
        Ok((_, target)) => target,
        Err(detail) => {
            return Readiness::Unreachable {
                checked_at: timestamp(),
                detail: Some(detail),
            }
        }
    };

    let client = match http_client(REQUEST_TIMEOUT) {
        Ok(client) => client,
        Err(detail) => {
            return Readiness::Unreachable {
                checked_at: timestamp(),
                detail: Some(detail),
            }
        }
    };

    match client.get(target).send().await {
        Ok(response) if matches!(response.status().as_u16(), 401 | 403) => {
            Readiness::Unauthorised {
                checked_at: timestamp(),
                detail: None,
            }
        }
        Ok(response) if response.status().is_success() => Readiness::Ready {
            checked_at: timestamp(),
            version: None,
        },
        Ok(response) => Readiness::Unreachable {
            checked_at: timestamp(),
            detail: Some(format!(
                "Responded with status {}",
                response.status().as_u16()
            )),
        },
        Err(cause) => Readiness::Unreachable {
            checked_at: timestamp(),
            detail: Some(cause.to_string()),
        },
    }
}

#[tauri::command]
async fn discover_models(endpoint_id: String) -> Result<Vec<DiscoveredModel>, String> {
    let (endpoint, base) = authorised_endpoint(&endpoint_id)?;
    let target = base
        .join(discovery::models_path(&endpoint))
        .map_err(|cause| cause.to_string())?;

    let response = http_client(DISCOVERY_TIMEOUT)?
        .get(target)
        .send()
        .await
        .map_err(|cause| cause.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "{} answered with status {}",
            endpoint.label,
            response.status().as_u16()
        ));
    }

    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|cause| cause.to_string())?;

    Ok(discovery::parse_models(&endpoint, &body, &timestamp()))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_endpoints,
            probe_endpoint,
            discover_models
        ])
        .run(tauri::generate_context!())
        .expect("Polychat desktop failed to start");
}
