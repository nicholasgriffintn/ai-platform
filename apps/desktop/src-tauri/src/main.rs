#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agents;
mod chat;
mod diagnostics;
mod discovery;
mod egress;
mod lines;
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
use lines::LineReader;
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
const RUN_IDLE_TIMEOUT: Duration = Duration::from_secs(120);
const CANCEL_POLL: Duration = Duration::from_millis(200);
const MAX_JSON_BODY: usize = 8 * 1024 * 1024;
const BUILT_IN_APPROVED_AT: &str = "1970-01-01T00:00:00Z";
const SESSION_SECRET: &str = "session-token";
const API_BASE_URL: &str = match option_env!("POLYCHAT_API_BASE_URL") {
    Some(value) => value,
    None if cfg!(debug_assertions) => "http://localhost:8787",
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
    let mut reader = LineReader::default();

    loop {
        let Some(piece) = next_piece(&mut stream, run_id, registry).await else {
            return Ok("cancelled");
        };

        let piece = match piece {
            Some(Ok(piece)) => piece,
            Some(Err(cause)) => {
                emit(StreamEvent::Failed {
                    run_id: run_id.to_string(),
                    failure: "unknown".to_string(),
                    message: cause.to_string(),
                });

                return Ok("interrupted");
            }
            None => return Ok("complete"),
        };

        reader.push(&piece);

        if reader.overflowed() {
            emit(StreamEvent::Failed {
                run_id: run_id.to_string(),
                failure: "unknown".to_string(),
                message: "The runtime sent a single line too large to read.".to_string(),
            });

            return Ok("interrupted");
        }

        while let Some(line) = reader.next_line() {
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
}

type PieceResult = Option<Result<bytes::Bytes, reqwest::Error>>;

async fn next_piece<S>(stream: &mut S, run_id: &str, registry: &RunRegistry) -> Option<PieceResult>
where
    S: futures_util::Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Unpin,
{
    loop {
        if registry.is_cancelled(run_id) {
            return None;
        }

        tokio::select! {
            piece = stream.next() => return Some(piece),
            _ = tokio::time::sleep(CANCEL_POLL) => {}
        }
    }
}

fn with_pairing(
    builder: reqwest::RequestBuilder,
    endpoint: &DesktopEndpoint,
) -> Result<reqwest::RequestBuilder, String> {
    match secrets::read(&secrets::pairing_key(&endpoint.id))? {
        Some(secret) => Ok(builder.bearer_auth(secret)),
        None => Ok(builder),
    }
}

async fn read_bounded_json(response: reqwest::Response) -> Result<serde_json::Value, String> {
    let mut stream = response.bytes_stream();
    let mut body: Vec<u8> = Vec::new();

    while let Some(piece) = stream.next().await {
        let piece = piece.map_err(|cause| cause.to_string())?;

        body.extend_from_slice(&piece);

        if body.len() > MAX_JSON_BODY {
            return Err(
                "That runtime answered with more than this application will read.".to_string(),
            );
        }
    }

    serde_json::from_slice(&body).map_err(|cause| cause.to_string())
}

fn user_agent() -> String {
    format!(
        "Polychat-Desktop/{} ({})",
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS
    )
}

fn http_client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(user_agent())
        .timeout(timeout)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|cause| cause.to_string())
}

fn streaming_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(user_agent())
        .read_timeout(RUN_IDLE_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|cause| cause.to_string())
}

#[tauri::command]
fn list_endpoints(store: State<'_, Store>) -> Result<Vec<DesktopEndpoint>, String> {
    store.list_endpoints()
}

#[tauri::command]
fn save_endpoint(
    endpoint: DesktopEndpoint,
    pairing_secret: Option<String>,
    store: State<'_, Store>,
) -> Result<(), String> {
    let key = secrets::pairing_key(&endpoint.id);

    match pairing_secret.as_deref().map(str::trim) {
        Some(secret) if !secret.is_empty() => secrets::store(&key, secret)?,
        Some(_) => secrets::forget(&key)?,
        None => {}
    }

    let mut endpoint = endpoint;

    endpoint.pairing_secret_stored = secrets::read(&key)?.is_some();

    egress::resolve_target(std::slice::from_ref(&endpoint), &endpoint.id)
        .map_err(refusal_detail)?;

    store.save_endpoint(&endpoint)
}

#[tauri::command]
fn forget_endpoint(endpoint_id: String, store: State<'_, Store>) -> Result<(), String> {
    secrets::forget(&secrets::pairing_key(&endpoint_id))?;

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

    let body = read_bounded_json(response).await?;

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
fn list_local_chats(scope: String, store: State<'_, Store>) -> Result<Vec<String>, String> {
    store.list_local_chats(&scope)
}

#[tauri::command]
fn save_local_chat(
    scope: String,
    id: String,
    payload: String,
    updated_at: String,
    store: State<'_, Store>,
) -> Result<(), String> {
    store.save_local_chat(&scope, &id, &payload, &updated_at)
}

#[tauri::command]
fn delete_local_chat(scope: String, id: String, store: State<'_, Store>) -> Result<(), String> {
    store.delete_local_chat(&scope, &id)
}

#[tauri::command]
fn delete_all_local_chats(scope: String, store: State<'_, Store>) -> Result<(), String> {
    store.delete_all_local_chats(&scope)
}

#[tauri::command]
async fn access_token() -> Result<String, String> {
    let Some(session) = secrets::read(SESSION_SECRET)? else {
        return Err("Sign in before using Polychat.".to_string());
    };

    let response = http_client(REQUEST_TIMEOUT)?
        .get(format!("{API_BASE_URL}/auth/token"))
        .header(reqwest::header::COOKIE, format!("session={session}"))
        .send()
        .await
        .map_err(|cause| cause.to_string())?;

    if !response.status().is_success() {
        let status = response.status().as_u16();

        if status == 401 {
            secrets::forget(SESSION_SECRET)?;
        }

        let detail = response.text().await.unwrap_or_default();

        return Err(sign_in_failure(status, &detail));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|cause| cause.to_string())?
        .get("token")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "Polychat returned no access token.".to_string())
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
    let state = new_client_state();
    let listener = link::LoopbackListener::bind(state.clone())?;
    let redirect_uri = listener.redirect_uri();
    let authorise = format!(
        "{API_BASE_URL}/auth/github?platform=desktop&redirect_uri={}&client_state={}",
        encode_query_value(&redirect_uri),
        encode_query_value(&state)
    );

    opener::open_browser(&authorise).map_err(|cause| cause.to_string())?;

    let code = tauri::async_runtime::spawn_blocking(move || {
        listener.wait_for_code(Duration::from_secs(300))
    })
    .await
    .map_err(|cause| cause.to_string())??;

    let response = http_client(REQUEST_TIMEOUT)?
        .post(format!("{API_BASE_URL}/auth/native/exchange"))
        .json(&serde_json::json!({ "code": code }))
        .send()
        .await
        .map_err(|cause| cause.to_string())?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let detail = response.text().await.unwrap_or_default();

        return Err(sign_in_failure(status, &detail));
    }

    let session = read_session_cookie(response.headers())
        .ok_or_else(|| "Sign-in returned no session.".to_string())?;

    secrets::store(SESSION_SECRET, &session)
}

fn read_session_cookie(headers: &reqwest::header::HeaderMap) -> Option<String> {
    headers
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .find_map(|value| {
            value
                .split(';')
                .next()?
                .trim()
                .strip_prefix("session=")
                .map(str::to_string)
        })
        .filter(|session| !session.is_empty())
}

fn sign_in_failure(status: u16, body: &str) -> String {
    let detail = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .or_else(|| value.get("message"))
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_default();

    if detail.is_empty() {
        format!("Sign-in could not be completed (status {status}).")
    } else {
        format!("Sign-in could not be completed: {detail}")
    }
}

fn encode_query_value(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

fn new_client_state() -> String {
    let mut bytes = [0u8; 32];

    getrandom::fill(&mut bytes).expect("the operating system random source");

    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
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

    let response = with_pairing(http_client(DISCOVERY_TIMEOUT)?.get(target), &endpoint)?
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

    let body = read_bounded_json(response).await?;

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

    let response = with_pairing(
        http_client(REQUEST_TIMEOUT)?
            .post(target)
            .json(&agents::decision_body(approved)),
        &endpoint,
    )?
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

    registry.begin(&run_id);

    emit(StreamEvent::Started {
        run_id: run_id.clone(),
        endpoint_id: endpoint.id.clone(),
        at: timestamp(),
    });

    let response = match with_pairing(
        streaming_client()?
            .post(target)
            .json(&agents::prompt_body(&prompt)),
        &endpoint,
    )?
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
    let mut reader = LineReader::default();

    loop {
        let Some(piece) = next_piece(&mut stream, run_id, registry).await else {
            return "cancelled";
        };

        let piece = match piece {
            Some(Ok(piece)) => piece,
            Some(Err(_)) => return "interrupted",
            None => return "complete",
        };

        reader.push(&piece);

        if reader.overflowed() {
            return "interrupted";
        }

        while let Some(line) = reader.next_line() {
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

fn executing_host(endpoint: &DesktopEndpoint) -> String {
    Url::parse(&endpoint.url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| endpoint.label.clone())
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

    registry.begin(&run_id);

    emit(StreamEvent::Started {
        run_id: run_id.clone(),
        endpoint_id: endpoint.id.clone(),
        at: timestamp(),
    });
    emit(StreamEvent::Progress {
        run_id: run_id.clone(),
        state: "loading-model".to_string(),
    });

    let response = match streaming_client()?
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
            access_token,
            is_signed_in,
            list_conversations,
            save_conversation,
            list_messages,
            append_message,
            list_local_chats,
            save_local_chat,
            delete_local_chat,
            delete_all_local_chats,
            start_model_run,
            list_agent_sessions,
            start_agent_run,
            decide_approval,
            collect_diagnostics,
            cancel_model_run
        ])
        .run(tauri::generate_context!())
        .expect("Polychat desktop failed to start");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifies_itself_to_the_api_as_a_desktop_client() {
        let agent = user_agent();

        assert!(agent.starts_with("Polychat-Desktop/"));
        assert!(agent.contains('('), "the agent needs a platform comment: {agent}");
        assert!(agent.ends_with(')'), "the agent needs a platform comment: {agent}");
    }
}
