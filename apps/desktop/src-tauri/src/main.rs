#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agents;
mod chat;
mod diagnostics;
mod discovery;
mod egress;
mod link;
mod runs;
mod secrets;
mod store;

use std::time::Duration;

use agents::{AgentApprovalRequest, AgentChunk, AgentSession};
use chat::{ModelRunRequest, StreamChunk};
use diagnostics::Diagnostics;
use discovery::DiscoveredModel;
use egress::{DesktopEndpoint, EgressRefusal, EndpointKind, EndpointTransport};
use futures_util::StreamExt;
use runs::{RunRegistry, StreamEvent};
use rusqlite::Connection;
use serde::Serialize;
use store::{LocalConversation, LocalMessage, Store};
use tauri::ipc::Channel;
use tauri::{Manager, State};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use url::Url;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);
const DISCOVERY_TIMEOUT: Duration = Duration::from_secs(10);
const RUN_TIMEOUT: Duration = Duration::from_secs(600);
const BUILT_IN_APPROVED_AT: &str = "1970-01-01T00:00:00Z";
const SESSION_SECRET: &str = "session-token";
const HOSTED_ENDPOINT_ID: &str = "polychat-cloud";
const API_BASE_URL: &str = match option_env!("POLYCHAT_API_BASE_URL") {
    Some(value) => value,
    None => "https://api.polychat.app",
};

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

async fn stream_lines(
    response: reqwest::Response,
    run_id: &str,
    registry: &RunRegistry,
    mut parse: impl FnMut(&str) -> StreamChunk,
    emit: &impl Fn(StreamEvent),
) -> Result<&'static str, String> {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(piece) = stream.next().await {
        if registry.is_cancelled(run_id) {
            return Ok("cancelled");
        }

        let piece = match piece {
            Ok(piece) => piece,
            Err(cause) => {
                emit(StreamEvent::Failed {
                    run_id: run_id.to_string(),
                    failure: "unknown".to_string(),
                    message: cause.to_string(),
                });

                return Ok("interrupted");
            }
        };

        buffer.push_str(&String::from_utf8_lossy(&piece));

        while let Some(index) = buffer.find('\n') {
            let line: String = buffer.drain(..=index).collect();

            match parse(&line) {
                StreamChunk::Text(delta) => emit(StreamEvent::Text {
                    run_id: run_id.to_string(),
                    delta,
                }),
                StreamChunk::Done => return Ok("complete"),
                StreamChunk::Ignored => {}
            }
        }
    }

    Ok("complete")
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
fn list_conversations(
    account_id: String,
    store: State<'_, Store>,
) -> Result<Vec<LocalConversation>, String> {
    store.list_conversations(&account_id)
}

#[tauri::command]
fn save_conversation(
    conversation: LocalConversation,
    store: State<'_, Store>,
) -> Result<(), String> {
    store.save_conversation(&conversation)
}

#[tauri::command]
fn list_messages(
    conversation_id: String,
    store: State<'_, Store>,
) -> Result<Vec<LocalMessage>, String> {
    store.list_messages(&conversation_id)
}

#[tauri::command]
fn append_message(message: LocalMessage, store: State<'_, Store>) -> Result<(), String> {
    store.append_message(&message)
}

#[tauri::command]
fn is_signed_in() -> Result<bool, String> {
    Ok(secrets::read(SESSION_SECRET)?.is_some())
}

#[tauri::command]
fn sign_out() -> Result<(), String> {
    secrets::forget(SESSION_SECRET)
}

#[tauri::command]
async fn sign_in() -> Result<(), String> {
    let listener = link::LoopbackListener::bind()?;
    let redirect_uri = listener.redirect_uri();
    let authorise = format!(
        "{API_BASE_URL}/auth/github?platform=desktop&redirect_uri={}",
        encode_query_value(&redirect_uri)
    );

    opener::open_browser(&authorise).map_err(|cause| cause.to_string())?;

    let code = tauri::async_runtime::spawn_blocking(move || {
        listener.wait_for_code(Duration::from_secs(300))
    })
    .await
    .map_err(|cause| cause.to_string())??;

    let response = http_client(REQUEST_TIMEOUT)?
        .post(format!("{API_BASE_URL}/auth/mobile/exchange"))
        .json(&serde_json::json!({ "code": code }))
        .send()
        .await
        .map_err(|cause| cause.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Sign-in could not be completed: the server answered with status {}",
            response.status().as_u16()
        ));
    }

    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|cause| cause.to_string())?;
    let token = body
        .get("token")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Sign-in returned no session.".to_string())?;

    secrets::store(SESSION_SECRET, token)
}

fn encode_query_value(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

#[tauri::command]
async fn start_hosted_run(
    run_id: String,
    request: chat::HostedRunRequest,
    on_event: Channel<StreamEvent>,
    registry: State<'_, RunRegistry>,
) -> Result<(), String> {
    let Some(session) = secrets::read(SESSION_SECRET)? else {
        return Err("Sign in before using a cloud model.".to_string());
    };

    let emit = |event: StreamEvent| {
        let _ = on_event.send(event);
    };

    emit(StreamEvent::Started {
        run_id: run_id.clone(),
        endpoint_id: HOSTED_ENDPOINT_ID.to_string(),
        at: timestamp(),
    });
    emit(StreamEvent::Progress {
        run_id: run_id.clone(),
        state: "queued".to_string(),
    });

    let response = match http_client(RUN_TIMEOUT)?
        .post(format!("{API_BASE_URL}/chat/completions"))
        .bearer_auth(session)
        .json(&chat::hosted_body(&request))
        .send()
        .await
    {
        Ok(response) => response,
        Err(cause) => {
            registry.forget(&run_id);
            emit(StreamEvent::Failed {
                run_id: run_id.clone(),
                failure: "unreachable".to_string(),
                message: cause.to_string(),
            });

            return Ok(());
        }
    };

    if !response.status().is_success() {
        let failure = match response.status().as_u16() {
            401 | 403 => "unauthorised",
            404 => "model-not-found",
            _ => "unknown",
        };
        let status = response.status().as_u16();

        registry.forget(&run_id);
        emit(StreamEvent::Failed {
            run_id: run_id.clone(),
            failure: failure.to_string(),
            message: format!("Polychat answered with status {status}"),
        });

        return Ok(());
    }

    emit(StreamEvent::Progress {
        run_id: run_id.clone(),
        state: "generating".to_string(),
    });

    let reason = stream_lines(response, &run_id, &registry, chat::parse_hosted_line, &emit).await?;

    registry.forget(&run_id);
    emit(StreamEvent::Finished {
        run_id,
        reason: reason.to_string(),
        at: timestamp(),
    });

    Ok(())
}

fn executing_host(endpoint: &DesktopEndpoint) -> String {
    Url::parse(&endpoint.url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| endpoint.label.clone())
}

#[tauri::command]
async fn list_agent_sessions(
    endpoint_id: String,
    store: State<'_, Store>,
) -> Result<Vec<AgentSession>, String> {
    let (endpoint, base) = authorised_endpoint(&store, &endpoint_id)?;
    let target = base
        .join(agents::sessions_path(&endpoint))
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

    Ok(agents::parse_sessions(
        &endpoint,
        &body,
        &executing_host(&endpoint),
    ))
}

#[tauri::command]
async fn decide_approval(
    endpoint_id: String,
    request_id: String,
    approved: bool,
    store: State<'_, Store>,
) -> Result<(), String> {
    let (endpoint, base) = authorised_endpoint(&store, &endpoint_id)?;
    let target = base
        .join(&agents::decision_path(&endpoint, &request_id))
        .map_err(|cause| cause.to_string())?;

    let response = http_client(REQUEST_TIMEOUT)?
        .post(target)
        .json(&agents::decision_body(approved))
        .send()
        .await
        .map_err(|cause| cause.to_string())?;

    if response.status().is_success() {
        return Ok(());
    }

    Err(format!(
        "{} refused the decision with status {}",
        endpoint.label,
        response.status().as_u16()
    ))
}

#[tauri::command]
async fn start_agent_run(
    run_id: String,
    endpoint_id: String,
    session_native_id: String,
    prompt: String,
    on_event: Channel<StreamEvent>,
    registry: State<'_, RunRegistry>,
    store: State<'_, Store>,
) -> Result<(), String> {
    let (endpoint, base) = authorised_endpoint(&store, &endpoint_id)?;
    let target = base
        .join(&agents::prompt_path(&endpoint, &session_native_id))
        .map_err(|cause| cause.to_string())?;
    let host = executing_host(&endpoint);

    let emit = |event: StreamEvent| {
        let _ = on_event.send(event);
    };

    emit(StreamEvent::Started {
        run_id: run_id.clone(),
        endpoint_id: endpoint.id.clone(),
        at: timestamp(),
    });

    let response = match http_client(RUN_TIMEOUT)?
        .post(target)
        .json(&agents::prompt_body(&prompt))
        .send()
        .await
    {
        Ok(response) => response,
        Err(cause) => {
            registry.forget(&run_id);
            emit(StreamEvent::Failed {
                run_id: run_id.clone(),
                failure: "unreachable".to_string(),
                message: cause.to_string(),
            });

            return Ok(());
        }
    };

    if !response.status().is_success() {
        let failure = match response.status().as_u16() {
            401 | 403 => "unauthorised",
            404 => "session-gone",
            _ => "agent-error",
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

    let reason = stream_agent(
        response,
        &run_id,
        &registry,
        &session_native_id,
        &host,
        &emit,
    )
    .await;

    registry.forget(&run_id);
    emit(StreamEvent::Finished {
        run_id,
        reason: reason.to_string(),
        at: timestamp(),
    });

    Ok(())
}

async fn stream_agent(
    response: reqwest::Response,
    run_id: &str,
    registry: &RunRegistry,
    session_native_id: &str,
    host: &str,
    emit: &impl Fn(StreamEvent),
) -> &'static str {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(piece) = stream.next().await {
        if registry.is_cancelled(run_id) {
            return "cancelled";
        }

        let Ok(piece) = piece else {
            return "interrupted";
        };

        buffer.push_str(&String::from_utf8_lossy(&piece));

        while let Some(index) = buffer.find('\n') {
            let line: String = buffer.drain(..=index).collect();

            match agents::parse_agent_line(&line, session_native_id, host) {
                AgentChunk::Text(delta) => emit(StreamEvent::Text {
                    run_id: run_id.to_string(),
                    delta,
                }),
                AgentChunk::Approval(request) => emit(approval_event(run_id, request)),
                AgentChunk::Done => return "complete",
                AgentChunk::Ignored => {}
            }
        }
    }

    "complete"
}

fn approval_event(run_id: &str, request: AgentApprovalRequest) -> StreamEvent {
    StreamEvent::ApprovalRequired {
        run_id: run_id.to_string(),
        request,
    }
}

#[tauri::command]
fn collect_diagnostics(
    app: tauri::AppHandle,
    store: State<'_, Store>,
) -> Result<Diagnostics, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|cause| cause.to_string())?;

    Ok(Diagnostics {
        app_version: app.package_info().version.to_string(),
        target: format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        api_base_url: API_BASE_URL.to_string(),
        database_path: directory.join("polychat.sqlite").display().to_string(),
        endpoint_count: store.list_endpoints()?.len(),
        keychain_available: secrets::read(SESSION_SECRET).is_ok(),
        signed_in: secrets::read(SESSION_SECRET)?.is_some(),
        collected_at: timestamp(),
    })
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

    let reason = stream_lines(
        response,
        &run_id,
        &registry,
        |line| chat::parse_stream_line(&endpoint, line),
        &emit,
    )
    .await?;

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
            sign_in,
            sign_out,
            is_signed_in,
            list_conversations,
            save_conversation,
            list_messages,
            append_message,
            start_model_run,
            start_hosted_run,
            list_agent_sessions,
            start_agent_run,
            decide_approval,
            collect_diagnostics,
            cancel_model_run
        ])
        .run(tauri::generate_context!())
        .expect("Polychat desktop failed to start");
}
