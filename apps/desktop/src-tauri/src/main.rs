#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agents;
mod announcements;
mod chat;
mod diagnostics;
mod discovery;
mod egress;
mod encoding;
mod lines;
mod link;
mod links;
mod model_runner;
mod programs;
mod runs;
mod secrets;
mod service;
mod store;

use std::time::Duration;

use agents::process::{self, AgentDriver, AgentToolState, DirectoryGrants, ProcessRunRequest};
use agents::session::{AgentSessionRegistry, SessionDescriptor, SessionEvent, SessionStartRequest};
use announcements::{Announcement, AnnouncementPlan};
use chat::ModelRunRequest;
use diagnostics::Diagnostics;
use discovery::DiscoveredModel;
use egress::{describe_transport_failure, DesktopEndpoint, EgressRefusal, TransportFailure};
use futures_util::StreamExt;
use runs::{RunRegistry, StreamEvent};
use rusqlite::Connection;
use serde::Serialize;
use store::{AgentThreadBinding, LocalConversation, LocalMessage, Store};
use tauri::ipc::Channel;
use tauri::{Emitter, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use url::Url;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);
const DISCOVERY_TIMEOUT: Duration = Duration::from_secs(10);
const RUN_IDLE_TIMEOUT: Duration = Duration::from_secs(120);
const CANCEL_POLL: Duration = Duration::from_millis(200);
const MAX_JSON_BODY: usize = 8 * 1024 * 1024;
const FALLBACK_TIMESTAMP: &str = "1970-01-01T00:00:00Z";
const DEFAULT_TOKEN_LIFETIME_SECONDS: u32 = 15 * 60;
const API_LABEL: &str = "Polychat";
const API_BASE_URL: &str = match option_env!("POLYCHAT_API_BASE_URL") {
    Some(value) => value,
    None if cfg!(debug_assertions) => "http://localhost:8787",
    None => "https://api.polychat.app",
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionToken {
    token: String,
    expires_in: u32,
}

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
        .unwrap_or_else(|_| FALLBACK_TIMESTAMP.to_string())
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
    with_pairing_secret(builder, endpoint, None)
}

fn with_pairing_secret(
    builder: reqwest::RequestBuilder,
    endpoint: &DesktopEndpoint,
    pairing_secret: Option<&str>,
) -> Result<reqwest::RequestBuilder, String> {
    let secret = match pairing_secret
        .map(str::trim)
        .filter(|secret| !secret.is_empty())
    {
        Some(secret) => Some(secret.to_string()),
        None => secrets::read(&secrets::pairing_key(&endpoint.id))?,
    };

    match secret {
        Some(secret) => Ok(builder.bearer_auth(secret.as_str())),
        None => Ok(builder),
    }
}

async fn read_bounded_json(
    response: reqwest::Response,
    label: &str,
) -> Result<serde_json::Value, String> {
    let mut stream = response.bytes_stream();
    let mut body: Vec<u8> = Vec::new();

    while let Some(piece) = stream.next().await {
        let piece = piece.map_err(|cause| transport_failure(label, &cause))?;

        body.extend_from_slice(&piece);

        if body.len() > MAX_JSON_BODY {
            return Err(
                "That runtime answered with more than this application will read.".to_string(),
            );
        }
    }

    serde_json::from_slice(&body)
        .map_err(|_| describe_transport_failure(label, TransportFailure::Unreadable))
}

fn classify_transport(cause: &reqwest::Error) -> TransportFailure {
    if cause.is_timeout() {
        TransportFailure::Timeout
    } else if cause.is_connect() || cause.is_request() {
        TransportFailure::Unreachable
    } else if cause.is_body() || cause.is_decode() {
        TransportFailure::Unreadable
    } else {
        TransportFailure::Refused
    }
}

fn transport_failure(label: &str, cause: &reqwest::Error) -> String {
    describe_transport_failure(label, classify_transport(cause))
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
    let existing_secret = secrets::read(&key)?;
    let requested_secret = pairing_secret.as_deref().map(str::trim);
    let pairing_secret_stored = match requested_secret {
        Some(secret) if !secret.is_empty() => true,
        Some(_) => false,
        None => existing_secret.is_some(),
    };
    let mut candidate = endpoint.clone();

    candidate.pairing_secret_stored = pairing_secret_stored;

    egress::resolve_target(std::slice::from_ref(&candidate), &candidate.id)
        .map_err(refusal_detail)?;

    match requested_secret {
        Some(secret) if !secret.is_empty() => secrets::store(&key, secret)?,
        Some(_) => secrets::forget(&key)?,
        None => {}
    }

    let mut endpoint = endpoint;

    endpoint.pairing_secret_stored = secrets::read(&key)?.is_some();

    store.save_endpoint(&endpoint)
}

#[tauri::command]
fn forget_endpoint(endpoint_id: String, store: State<'_, Store>) -> Result<(), String> {
    secrets::forget(&secrets::pairing_key(&endpoint_id))?;

    store.forget_endpoint(&endpoint_id)
}

#[tauri::command]
async fn probe_endpoint(
    endpoint: DesktopEndpoint,
    pairing_secret: Option<String>,
    store: State<'_, Store>,
) -> Result<Readiness, String> {
    let stored_secret = secrets::read(&secrets::pairing_key(&endpoint.id))?;
    let supplied_secret = pairing_secret
        .as_deref()
        .map(str::trim)
        .filter(|secret| !secret.is_empty());
    let mut endpoint = endpoint;

    endpoint.pairing_secret_stored = supplied_secret.is_some() || stored_secret.is_some();

    let target = match egress::resolve_target(std::slice::from_ref(&endpoint), &endpoint.id) {
        Ok(target) => target,
        Err(refusal) => {
            return Ok(Readiness::Unreachable {
                checked_at: timestamp(),
                detail: Some(refusal_detail(refusal)),
            })
        }
    };

    let request = http_client(REQUEST_TIMEOUT)
        .and_then(|client| with_pairing_secret(client.get(target), &endpoint, supplied_secret));
    let request = match request {
        Ok(request) => request,
        Err(detail) => {
            return Ok(Readiness::Unreachable {
                checked_at: timestamp(),
                detail: Some(detail),
            })
        }
    };

    Ok(match request.send().await {
        Ok(response) if matches!(response.status().as_u16(), 401 | 403) => {
            Readiness::Unauthorised {
                checked_at: timestamp(),
                detail: None,
            }
        }
        Ok(response) if response.status().is_success() => {
            let checked_at = timestamp();
            store.mark_endpoint_seen(&endpoint.id, &checked_at)?;

            Readiness::Ready {
                checked_at,
                version: None,
            }
        }
        Ok(response) => Readiness::Unreachable {
            checked_at: timestamp(),
            detail: Some(format!(
                "Responded with status {}",
                response.status().as_u16()
            )),
        },
        Err(cause) => Readiness::Unreachable {
            checked_at: timestamp(),
            detail: Some(transport_failure(&endpoint.label, &cause)),
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

    let response = with_pairing(http_client(DISCOVERY_TIMEOUT)?.get(target), &endpoint)?
        .send()
        .await
        .map_err(|cause| transport_failure(&endpoint.label, &cause))?;

    if !response.status().is_success() {
        return Err(format!(
            "{} answered with status {}",
            endpoint.label,
            response.status().as_u16()
        ));
    }

    let body = read_bounded_json(response, &endpoint.label).await?;

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
async fn access_token() -> Result<SessionToken, String> {
    let Some(session) = secrets::read(secrets::SESSION)? else {
        return Err("Sign in before using Polychat.".to_string());
    };

    let response = http_client(REQUEST_TIMEOUT)?
        .get(format!("{API_BASE_URL}/auth/token"))
        .header(reqwest::header::COOKIE, format!("session={session}"))
        .send()
        .await
        .map_err(|cause| transport_failure(API_LABEL, &cause))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();

        if status == 401 {
            secrets::forget(secrets::SESSION)?;
        }

        let detail = response.text().await.unwrap_or_default();

        return Err(sign_in_failure(status, &detail));
    }

    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|cause| transport_failure(API_LABEL, &cause))?;

    read_session_token(&body).ok_or_else(|| "Polychat returned no access token.".to_string())
}

fn read_session_token(body: &serde_json::Value) -> Option<SessionToken> {
    let token = body.get("token").and_then(serde_json::Value::as_str)?;

    if token.is_empty() {
        return None;
    }

    Some(SessionToken {
        token: token.to_string(),
        expires_in: body
            .get("expires_in")
            .and_then(serde_json::Value::as_u64)
            .and_then(|seconds| u32::try_from(seconds).ok())
            .filter(|seconds| *seconds > 0)
            .unwrap_or(DEFAULT_TOKEN_LIFETIME_SECONDS),
    })
}

#[tauri::command]
async fn is_signed_in() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        secrets::read(secrets::SESSION).map(|secret| secret.is_some())
    })
    .await
    .map_err(|cause| cause.to_string())?
}

#[tauri::command]
fn sign_out() -> Result<(), String> {
    secrets::forget(secrets::SESSION)
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
        .map_err(|cause| transport_failure(API_LABEL, &cause))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let detail = response.text().await.unwrap_or_default();

        return Err(sign_in_failure(status, &detail));
    }

    let session = read_session_cookie(response.headers())
        .ok_or_else(|| "Sign-in returned no session.".to_string())?;

    secrets::store(secrets::SESSION, &session)
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
fn list_agent_directories(store: State<'_, Store>) -> Result<Vec<process::DirectoryGrant>, String> {
    store.list_agent_directories()
}

#[tauri::command]
fn save_agent_directory(
    path: String,
    directories: State<'_, DirectoryGrants>,
    store: State<'_, Store>,
) -> Result<process::DirectoryGrant, String> {
    let directory = directories
        .add(std::path::Path::new(&path))
        .map_err(|cause| format!("{cause:?}"))?;
    store.save_agent_directory(&directory)?;
    Ok(directory)
}

#[tauri::command]
async fn pick_agent_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Choose the project folder for your coding agent. It will work with files in this folder.")
            .blocking_pick_folder()
            .map(|path| path.to_string())
    })
    .await
    .map_err(|cause| cause.to_string())
}

#[tauri::command]
fn revoke_agent_directory(
    directory_id: String,
    directories: State<'_, DirectoryGrants>,
    store: State<'_, Store>,
) -> Result<(), String> {
    directories
        .remove(&directory_id)
        .map_err(|cause| format!("{cause:?}"))?;
    store.revoke_agent_directory(&directory_id)
}

#[tauri::command]
fn read_agent_thread(
    conversation_id: String,
    store: State<'_, Store>,
) -> Result<Option<AgentThreadBinding>, String> {
    store.read_agent_thread(&conversation_id)
}

#[tauri::command]
fn save_agent_thread(binding: AgentThreadBinding, store: State<'_, Store>) -> Result<(), String> {
    store.save_agent_thread(&binding)
}

#[tauri::command]
fn forget_agent_thread(conversation_id: String, store: State<'_, Store>) -> Result<(), String> {
    store.forget_agent_thread(&conversation_id)
}

#[tauri::command]
async fn probe_agent_tool(driver: AgentDriver) -> AgentToolState {
    process::probe(driver, timestamp()).await
}

#[tauri::command]
async fn start_agent_process_run(
    run_id: String,
    request: ProcessRunRequest,
    on_event: Channel<StreamEvent>,
    directories: State<'_, DirectoryGrants>,
    registry: State<'_, RunRegistry>,
    store: State<'_, Store>,
) -> Result<(), String> {
    agents::runner::run(run_id, request, on_event, &directories, &registry, &store).await
}

#[tauri::command]
async fn start_agent_session(
    request: SessionStartRequest,
    on_event: Channel<SessionEvent>,
    directories: State<'_, DirectoryGrants>,
    sessions: State<'_, AgentSessionRegistry>,
) -> Result<SessionDescriptor, String> {
    agents::session::start(request, on_event, &directories, &sessions).await
}

#[tauri::command]
async fn send_agent_session(
    session_key: String,
    payload: String,
    sessions: State<'_, AgentSessionRegistry>,
) -> Result<(), String> {
    agents::session::send(&session_key, &payload, &sessions).await
}

#[tauri::command]
async fn stop_agent_session(
    session_key: String,
    sessions: State<'_, AgentSessionRegistry>,
) -> Result<(), String> {
    agents::session::stop(&session_key, &sessions).await
}

#[tauri::command]
fn agent_supports_sessions(driver: AgentDriver) -> bool {
    process::supports_sessions(driver)
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
        machine_id: store.machine_id()?,
        platform: std::env::consts::OS.to_string(),
        target: format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        api_base_url: API_BASE_URL.to_string(),
        database_path: directory.join("polychat.sqlite").display().to_string(),
        endpoint_count: store.list_endpoints()?.len(),
        collected_at: timestamp(),
    })
}

#[tauri::command]
fn announce_attention(
    scope: String,
    items: Vec<Announcement>,
    app: tauri::AppHandle,
    store: State<'_, Store>,
) -> Result<usize, String> {
    let ids: Vec<String> = items.iter().map(|item| item.id.clone()).collect();
    let unshown = store.unshown(&scope, &ids)?;
    let pending: Vec<Announcement> = items
        .into_iter()
        .filter(|item| unshown.contains(&item.id))
        .collect();
    let shown = pending.len();

    match announcements::plan(pending, announcements::MAX_INDIVIDUAL) {
        AnnouncementPlan::Nothing => return Ok(0),
        AnnouncementPlan::Each(items) => {
            for item in items {
                show(&app, &item.title, &item.body);
            }
        }
        AnnouncementPlan::Summary { count } => {
            show(&app, API_LABEL, &announcements::summary_body(count));
        }
    }

    store.record_shown(&scope, &unshown, &timestamp())?;
    store.forget_shown(&scope, announcements::LEDGER_LIMIT)?;

    Ok(shown)
}

fn show(app: &tauri::AppHandle, title: &str, body: &str) {
    let _ = app.notification().builder().title(title).body(body).show();
}

#[tauri::command]
fn set_attention_badge(count: u32, app: tauri::AppHandle) {
    for window in app.webview_windows().values() {
        let _ = window.set_badge_count(if count == 0 {
            None
        } else {
            Some(i64::from(count))
        });
    }
}

#[tauri::command]
fn cancel_model_run(run_id: String, registry: State<'_, RunRegistry>) {
    registry.cancel(&run_id);
}

#[tauri::command]
fn cancel_agent_process_run(run_id: String, registry: State<'_, RunRegistry>) {
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
    model_runner::run_model(run_id, request, &registry, &store, |event| {
        let _ = on_event.send(event);
    })
    .await
}

fn raise(app: &tauri::AppHandle) {
    for window in app.webview_windows().values() {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("service") {
        if let Err(error) = service::dispatch(&args) {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }
    let mut context = tauri::generate_context!();
    if args.iter().any(|arg| arg == "--service") {
        for window in &mut context.config_mut().app.windows {
            window.visible = false;
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if !argv.iter().any(|arg| arg == "--service") {
                raise(app);
            }

            if let Some(url) = links::find_deep_link(&argv) {
                let _ = app.emit(links::DEEP_LINK_EVENT, url.clone());
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let opened = app.handle().clone();

            app.deep_link().on_open_url(move |event| {
                raise(&opened);

                for url in event.urls() {
                    let _ = opened.emit(links::DEEP_LINK_EVENT, url.to_string());
                }
            });

            let directory = app.path().app_data_dir()?;

            std::fs::create_dir_all(&directory)?;

            let store = Store::open(Connection::open(directory.join("polychat.sqlite"))?)?;

            let directories = store.list_agent_directories()?;
            app.manage(store);
            app.manage(RunRegistry::default());
            app.manage(AgentSessionRegistry::default());
            app.manage(DirectoryGrants::from_grants(directories));

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
            list_agent_directories,
            save_agent_directory,
            pick_agent_directory,
            revoke_agent_directory,
            read_agent_thread,
            save_agent_thread,
            forget_agent_thread,
            probe_agent_tool,
            start_agent_process_run,
            start_agent_session,
            send_agent_session,
            stop_agent_session,
            agent_supports_sessions,
            collect_diagnostics,
            cancel_model_run,
            cancel_agent_process_run,
            announce_attention,
            set_attention_badge
        ])
        .run(context)
        .expect("Polychat desktop failed to start");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_lifetime_the_api_reports_with_a_token() {
        let token = read_session_token(&serde_json::json!({
            "token": "jwt-value",
            "expires_in": 900,
            "token_type": "Bearer"
        }))
        .expect("a token");

        assert_eq!(token.token, "jwt-value");
        assert_eq!(token.expires_in, 900);
    }

    #[test]
    fn falls_back_to_the_documented_lifetime_when_the_api_omits_one() {
        let token =
            read_session_token(&serde_json::json!({ "token": "jwt-value" })).expect("token");

        assert_eq!(token.expires_in, DEFAULT_TOKEN_LIFETIME_SECONDS);
    }

    #[test]
    fn refuses_a_response_carrying_no_usable_token() {
        assert!(read_session_token(&serde_json::json!({ "expires_in": 900 })).is_none());
        assert!(read_session_token(&serde_json::json!({ "token": "" })).is_none());
    }

    #[test]
    fn identifies_itself_to_the_api_as_a_desktop_client() {
        let agent = user_agent();

        assert!(agent.starts_with("Polychat-Desktop/"));
        assert!(
            agent.contains('('),
            "the agent needs a platform comment: {agent}"
        );
        assert!(
            agent.ends_with(')'),
            "the agent needs a platform comment: {agent}"
        );
    }
}
