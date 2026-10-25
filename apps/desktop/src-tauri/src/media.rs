use std::sync::OnceLock;

use tauri::http::{header, HeaderMap, HeaderValue, Method, Request, Response, StatusCode};
use tauri::{Runtime, UriSchemeContext, UriSchemeResponder};

use crate::{secrets, user_agent, API_BASE_URL};

pub const SCHEME: &str = "polychat-media";

const FORWARDED_REQUEST_HEADERS: [header::HeaderName; 3] = [
    header::RANGE,
    header::IF_NONE_MATCH,
    header::IF_MODIFIED_SINCE,
];
const FORWARDED_RESPONSE_HEADERS: [header::HeaderName; 7] = [
    header::CONTENT_TYPE,
    header::CONTENT_LENGTH,
    header::CONTENT_RANGE,
    header::ACCEPT_RANGES,
    header::CACHE_CONTROL,
    header::ETAG,
    header::LAST_MODIFIED,
];

pub fn handle<R: Runtime>(
    _context: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    tauri::async_runtime::spawn(async move {
        let origin = request.headers().get(header::ORIGIN).cloned();
        let mut response = match forward(&request).await {
            Ok(response) => response,
            Err((status, message)) => failure(status, message),
        };

        if let Some(origin) = origin {
            let headers = response.headers_mut();

            headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
            headers.insert(
                header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
                HeaderValue::from_static("true"),
            );
        }

        responder.respond(response);
    });
}

async fn forward(request: &Request<Vec<u8>>) -> Result<Response<Vec<u8>>, (StatusCode, String)> {
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return Err((
            StatusCode::METHOD_NOT_ALLOWED,
            "Polychat media is read-only.".to_string(),
        ));
    }

    let path = request
        .uri()
        .path_and_query()
        .map(|path| path.as_str())
        .unwrap_or("/");
    let session = secrets::read(secrets::SESSION)
        .map_err(|cause| (StatusCode::INTERNAL_SERVER_ERROR, cause))?
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Sign in before using Polychat.".to_string(),
        ))?;

    let upstream = client()?
        .request(request.method().clone(), format!("{API_BASE_URL}{path}"))
        .headers(forwarded(request.headers(), &FORWARDED_REQUEST_HEADERS))
        .header(header::COOKIE, format!("session={session}"))
        .send()
        .await
        .map_err(|cause| (StatusCode::BAD_GATEWAY, cause.to_string()))?;

    let status = upstream.status();
    let headers = forwarded(upstream.headers(), &FORWARDED_RESPONSE_HEADERS);
    let body = upstream
        .bytes()
        .await
        .map_err(|cause| (StatusCode::BAD_GATEWAY, cause.to_string()))?;

    let mut response = Response::new(body.to_vec());

    *response.status_mut() = status;
    *response.headers_mut() = headers;

    Ok(response)
}

fn forwarded(source: &HeaderMap, names: &[header::HeaderName]) -> HeaderMap {
    names
        .iter()
        .filter_map(|name| source.get(name).map(|value| (name.clone(), value.clone())))
        .collect()
}

fn failure(status: StatusCode, message: String) -> Response<Vec<u8>> {
    let mut response = Response::new(message.into_bytes());

    *response.status_mut() = status;

    response
}

fn client() -> Result<&'static reqwest::Client, (StatusCode, String)> {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

    if let Some(client) = CLIENT.get() {
        return Ok(client);
    }

    let client = reqwest::Client::builder()
        .user_agent(user_agent())
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|cause| (StatusCode::INTERNAL_SERVER_ERROR, cause.to_string()))?;

    Ok(CLIENT.get_or_init(|| client))
}
