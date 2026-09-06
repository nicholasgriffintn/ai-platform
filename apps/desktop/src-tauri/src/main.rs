#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod chat;
mod discovery;
mod egress;
mod runs;
mod store;

use std::time::Duration;

use chat::{ModelRunRequest, StreamChunk};
use discovery::DiscoveredModel;
use egress::{DesktopEndpoint, EgressRefusal, EndpointKind, EndpointTransport};
use futures_util::StreamExt;
use runs::{RunRegistry, StreamEvent};
use rusqlite::Connection;
use serde::Serialize;
use store::Store;
use tauri::ipc::Channel;
use tauri::{Manager, State};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use url::Url;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);
const DISCOVERY_TIMEOUT: Duration = Duration::from_secs(10);
const RUN_TIMEOUT: Duration = Duration::from_secs(600);
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

fn authorised_endpoint(store: &Store, endpoint_id: &str) -> Result<(DesktopEndpoint, Url), String> {
    let endpoints = store.list_endpoints()?;
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
fn list_endpoints(store: State<'_, Store>) -> Result<Vec<DesktopEndpoint>, String> {
    store.list_endpoints()
}

#[tauri::command]
fn save_endpoint(endpoint: DesktopEndpoint, store: State<'_, Store>) -> Result<(), String> {
    egress::resolve_target(std::slice::from_ref(&endpoint), &endpoint.id)
        .map_err(refusal_detail)?;

    store.save_endpoint(&endpoint)
}

#[tauri::command]
fn forget_endpoint(endpoint_id: String, store: State<'_, Store>) -> Result<(), String> {
    store.forget_endpoint(&endpoint_id)
}

#[tauri::command]
async fn probe_endpoint(endpoint_id: String, store: State<'_, Store>) -> Result<Readiness, String> {
    let target = match authorised_endpoint(&store, &endpoint_id) {
        Ok((_, target)) => target,
        Err(detail) => {
            return Ok(Readiness::Unreachable {
                checked_at: timestamp(),
                detail: Some(detail),
            })
        }
    };

    let client = match http_client(REQUEST_TIMEOUT) {
        Ok(client) => client,
        Err(detail) => {
            return Ok(Readiness::Unreachable {
                checked_at: timestamp(),
                detail: Some(detail),
            })
        }
    };

    Ok(match client.get(target).send().await {
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
    })
}

#[tauri::command]
async fn discover_models(
    endpoint_id: String,
    store: State<'_, Store>,
) -> Result<Vec<DiscoveredModel>, String> {
    let (endpoint, base) = authorised_endpoint(&store, &endpoint_id)?;
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

#[tauri::command]
fn cancel_model_run(run_id: String, registry: State<'_, RunRegistry>) {
    registry.cancel(&run_id);
}

#[tauri::command]
async fn start_model_run(
    run_id: String,
    request: ModelRunRequest,
    on_event: Channel<StreamEvent>,
    registry: State<'_, RunRegistry>,
    store: State<'_, Store>,
) -> Result<(), String> {
    let (endpoint, base) = authorised_endpoint(&store, &request.endpoint_id)?;
    let target = base
        .join(chat::chat_path(&endpoint))
        .map_err(|cause| cause.to_string())?;

    let emit = |event: StreamEvent| {
        let _ = on_event.send(event);
    };

    emit(StreamEvent::Started {
        run_id: run_id.clone(),
        endpoint_id: endpoint.id.clone(),
        at: timestamp(),
    });
    emit(StreamEvent::Progress {
        run_id: run_id.clone(),
        state: "loading-model".to_string(),
    });

    let response = match http_client(RUN_TIMEOUT)?
        .post(target)
        .json(&chat::chat_body(&endpoint, &request))
        .send()
        .await
    {
        Ok(response) => response,
        Err(cause) => {
            registry.forget(&run_id);
            emit(StreamEvent::Failed {
                run_id: run_id.clone(),
                failure: "not-running".to_string(),
                message: cause.to_string(),
            });

            return Ok(());
        }
    };

    if !response.status().is_success() {
        let failure = match response.status().as_u16() {
            404 => "model-not-found",
            401 | 403 => "unauthorised",
            _ => "unknown",
        };
        let status = response.status().as_u16();

        registry.forget(&run_id);
        emit(StreamEvent::Failed {
            run_id: run_id.clone(),
            failure: failure.to_string(),
            message: format!("{} answered with status {status}", endpoint.label),
        });

        return Ok(());
    }

    emit(StreamEvent::Progress {
        run_id: run_id.clone(),
        state: "generating".to_string(),
    });

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut reason = "complete";

    'outer: while let Some(piece) = stream.next().await {
        if registry.is_cancelled(&run_id) {
            reason = "cancelled";
            break;
        }

        let piece = match piece {
            Ok(piece) => piece,
            Err(cause) => {
                registry.forget(&run_id);
                emit(StreamEvent::Failed {
                    run_id: run_id.clone(),
                    failure: "unknown".to_string(),
                    message: cause.to_string(),
                });

                return Ok(());
            }
        };

        buffer.push_str(&String::from_utf8_lossy(&piece));

        while let Some(index) = buffer.find('\n') {
            let line: String = buffer.drain(..=index).collect();

            match chat::parse_stream_line(&endpoint, &line) {
                StreamChunk::Text(delta) => emit(StreamEvent::Text {
                    run_id: run_id.clone(),
                    delta,
                }),
                StreamChunk::Done => break 'outer,
                StreamChunk::Ignored => {}
            }
        }
    }

    registry.forget(&run_id);
    emit(StreamEvent::Finished {
        run_id,
        reason: reason.to_string(),
        at: timestamp(),
    });

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;

            std::fs::create_dir_all(&directory)?;

            let store = Store::open(Connection::open(directory.join("polychat.sqlite"))?)?;

            store.seed_missing(&configured_endpoints())?;

            app.manage(store);
            app.manage(RunRegistry::default());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_endpoints,
            probe_endpoint,
            discover_models,
            save_endpoint,
            forget_endpoint,
            start_model_run,
            cancel_model_run
        ])
        .run(tauri::generate_context!())
        .expect("Polychat desktop failed to start");
}
