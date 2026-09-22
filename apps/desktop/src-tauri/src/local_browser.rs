use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};
use tokio::process::{Child, Command};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::{Host, Url};

use crate::programs::resolve_program;

const BROWSER_TIMEOUT: Duration = Duration::from_secs(30);

struct BrowserSession {
    child: Child,
    port: u16,
    profile: PathBuf,
    fence: u64,
}

#[derive(Default)]
pub struct LocalBrowsers {
    sessions: Mutex<HashMap<String, BrowserSession>>,
}

impl LocalBrowsers {
    fn port(&self, id: &str) -> Result<u16, String> {
        self.sessions
            .lock()
            .map_err(|_| "Local browser registry is unavailable".to_string())?
            .get(id)
            .map(|session| session.port)
            .ok_or_else(|| "This local browser is not active".to_string())
    }

    fn authorised_port(&self, id: &str, fence: u64) -> Result<u16, String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "Local browser registry is unavailable".to_string())?;
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| "This local browser is not active".to_string())?;
        if fence < session.fence {
            return Err("The browser control lease is stale".to_string());
        }
        session.fence = fence;
        Ok(session.port)
    }

    fn revoke(&self, id: &str, fence: u64) -> Result<(), String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "Local browser registry is unavailable".to_string())?;
        if let Some(session) = sessions.get_mut(id) {
            session.fence = session.fence.max(fence.saturating_add(1));
        }
        Ok(())
    }

    async fn close(mut session: BrowserSession) {
        let _ = session.child.kill().await;
        let _ = session.child.wait().await;
        let _ = std::fs::remove_dir_all(&session.profile);
    }

    pub async fn stop_all(&self) {
        let sessions = match self.sessions.lock() {
            Ok(mut sessions) => sessions
                .drain()
                .map(|(_, session)| session)
                .collect::<Vec<_>>(),
            Err(_) => return,
        };
        for session in sessions {
            Self::close(session).await;
        }
    }
}

fn chrome_program() -> Option<PathBuf> {
    let candidates = if cfg!(target_os = "macos") {
        vec![PathBuf::from(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )]
    } else if cfg!(target_os = "windows") {
        ["PROGRAMFILES", "PROGRAMFILES(X86)"]
            .into_iter()
            .filter_map(std::env::var_os)
            .map(|root| PathBuf::from(root).join("Google/Chrome/Application/chrome.exe"))
            .collect()
    } else {
        vec![
            resolve_program("google-chrome"),
            resolve_program("chromium"),
        ]
    };
    candidates.into_iter().find(|path| path.is_file())
}

async fn debugger_port(profile: &PathBuf) -> Result<u16, String> {
    for _ in 0..100 {
        if let Ok(contents) = std::fs::read_to_string(profile.join("DevToolsActivePort")) {
            if let Some(port) = contents
                .lines()
                .next()
                .and_then(|line| line.parse::<u16>().ok())
            {
                return Ok(port);
            }
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    Err("Chrome did not open its local browser control port".to_string())
}

async fn page_socket(port: u16) -> Result<String, String> {
    let response = reqwest::Client::builder()
        .timeout(BROWSER_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| error.to_string())?
        .get(format!("http://127.0.0.1:{port}/json/list"))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let targets = response
        .json::<Vec<Value>>()
        .await
        .map_err(|error| error.to_string())?;
    targets
        .iter()
        .find(|target| target["type"] == "page")
        .and_then(|target| target["webSocketDebuggerUrl"].as_str())
        .map(str::to_string)
        .ok_or_else(|| "Chrome did not expose a browser tab".to_string())
}

async fn cdp(port: u16, method: &str, params: Value) -> Result<Value, String> {
    let socket = page_socket(port).await?;
    let work = async {
        let (mut connection, _) = connect_async(socket)
            .await
            .map_err(|error| error.to_string())?;
        connection
            .send(Message::Text(
                json!({ "id": 1, "method": method, "params": params })
                    .to_string()
                    .into(),
            ))
            .await
            .map_err(|error| error.to_string())?;
        while let Some(message) = connection.next().await {
            let message = message.map_err(|error| error.to_string())?;
            let Message::Text(text) = message else {
                continue;
            };
            let response: Value = serde_json::from_str(&text).map_err(|error| error.to_string())?;
            if response["id"] != 1 {
                continue;
            }
            if response.get("error").is_some() {
                return Err(format!("Chrome rejected {method}: {}", response["error"]));
            }
            return Ok(response["result"].clone());
        }
        Err("Chrome closed its browser control connection".to_string())
    };
    tokio::time::timeout(BROWSER_TIMEOUT, work)
        .await
        .map_err(|_| "Chrome browser control timed out".to_string())?
}

fn public_https_url(raw: &str) -> Result<String, String> {
    let url = Url::parse(raw).map_err(|_| "The browser URL is invalid".to_string())?;
    let private = match url.host().ok_or("The browser URL has no host")? {
        Host::Domain(host) => {
            host.eq_ignore_ascii_case("localhost")
                || host.ends_with(".localhost")
                || host.ends_with(".local")
        }
        Host::Ipv4(ip) => {
            ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast()
                || ip.is_multicast()
        }
        Host::Ipv6(ip) => {
            ip.is_loopback()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.is_unspecified()
                || ip.is_multicast()
        }
    };
    if url.scheme() != "https" || private || !url.username().is_empty() || url.password().is_some()
    {
        return Err("Only public HTTPS browser destinations are allowed".to_string());
    }
    Ok(url.to_string())
}

async fn page_text(port: u16) -> Result<Value, String> {
    let result = cdp(
        port,
        "Runtime.evaluate",
        json!({
            "expression": "({title:document.title,url:location.href,text:document.body?.innerText.slice(0,12000)??''})",
            "returnByValue": true,
        }),
    )
    .await?;
    Ok(result["result"]["value"].clone())
}

async fn observe(port: u16) -> Result<Value, String> {
    cdp(
        port,
        "Emulation.setDeviceMetricsOverride",
        json!({ "width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": false }),
    )
    .await?;
    let page = page_text(port).await?;
    let screenshot = cdp(
        port,
        "Page.captureScreenshot",
        json!({ "format": "jpeg", "quality": 45, "captureBeyondViewport": false }),
    )
    .await?;
    let image = screenshot["data"]
        .as_str()
        .ok_or("Chrome did not return a screenshot")?;
    if image.len() > 700_000 {
        return Err("The browser screenshot is too large to relay".to_string());
    }
    Ok(json!({
        "title": page["title"],
        "url": page["url"],
        "screenshot": format!("data:image/jpeg;base64,{image}"),
        "width": 1440,
        "height": 900,
    }))
}

#[tauri::command]
pub fn local_browser_available() -> bool {
    chrome_program().is_some()
}

#[tauri::command]
pub async fn start_local_browser(
    id: String,
    app: AppHandle,
    browsers: State<'_, LocalBrowsers>,
) -> Result<String, String> {
    if id.is_empty()
        || id.len() > 200
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    {
        return Err("Invalid local browser identifier".to_string());
    }
    if browsers.port(&id).is_ok() {
        return Ok(id);
    }
    let program = chrome_program().ok_or("Google Chrome is not installed")?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let profile = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("local-browsers")
        .join(format!("{id}-{nonce}"));
    std::fs::create_dir_all(&profile).map_err(|error| error.to_string())?;
    let mut child = Command::new(program)
        .arg("--remote-debugging-port=0")
        .arg("--remote-debugging-address=127.0.0.1")
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--window-size=1440,900")
        .arg("about:blank")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())?;
    let port = match debugger_port(&profile).await {
        Ok(port) => port,
        Err(error) => {
            let _ = child.kill().await;
            let _ = std::fs::remove_dir_all(&profile);
            return Err(error);
        }
    };
    browsers
        .sessions
        .lock()
        .map_err(|_| "Local browser registry is unavailable".to_string())?
        .insert(
            id.clone(),
            BrowserSession {
                child,
                port,
                profile,
                fence: 0,
            },
        );
    Ok(id)
}

#[tauri::command]
pub async fn local_browser_action(
    id: String,
    fence: u64,
    input: Value,
    browsers: State<'_, LocalBrowsers>,
) -> Result<Value, String> {
    let port = browsers.authorised_port(&id, fence)?;
    let kind = input["type"]
        .as_str()
        .ok_or("Browser action type is required")?;
    match kind {
        "navigate" => {
            let url = public_https_url(input["url"].as_str().ok_or("Browser URL is required")?)?;
            cdp(port, "Page.navigate", json!({ "url": url })).await?;
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
        "click" => {
            let x = input["x"]
                .as_u64()
                .filter(|value| *value < 1440)
                .ok_or("Invalid click x")?;
            let y = input["y"]
                .as_u64()
                .filter(|value| *value < 900)
                .ok_or("Invalid click y")?;
            let button = input["button"].as_str().unwrap_or("left");
            if !["left", "middle", "right"].contains(&button) {
                return Err("Invalid click button".to_string());
            }
            cdp(port, "Input.dispatchMouseEvent", json!({ "type": "mousePressed", "x": x, "y": y, "button": button, "clickCount": 1 })).await?;
            cdp(port, "Input.dispatchMouseEvent", json!({ "type": "mouseReleased", "x": x, "y": y, "button": button, "clickCount": 1 })).await?;
        }
        "type" => {
            let text = input["text"]
                .as_str()
                .filter(|text| text.len() <= 10_000)
                .ok_or("Invalid browser text")?;
            cdp(port, "Input.insertText", json!({ "text": text })).await?;
        }
        "key" => {
            let key = input["key"].as_str().ok_or("Browser key is required")?;
            let (name, modifiers) = match key {
                "BackSpace" | "Delete" | "Down" | "End" | "Escape" | "Home" | "Left"
                | "Page_Down" | "Page_Up" | "Return" | "Right" | "Tab" | "Up" => (key, 0),
                "ctrl+a" | "ctrl+c" | "ctrl+f" | "ctrl+l" | "ctrl+r" | "ctrl+v" | "ctrl+w" => {
                    (&key[5..], if cfg!(target_os = "macos") { 4 } else { 2 })
                }
                _ => return Err("Unsupported browser key".to_string()),
            };
            cdp(
                port,
                "Input.dispatchKeyEvent",
                json!({ "type": "keyDown", "key": name, "modifiers": modifiers }),
            )
            .await?;
            cdp(
                port,
                "Input.dispatchKeyEvent",
                json!({ "type": "keyUp", "key": name, "modifiers": modifiers }),
            )
            .await?;
        }
        "scroll" => {
            let amount = input["amount"]
                .as_i64()
                .filter(|value| (1..=20).contains(value))
                .ok_or("Invalid scroll amount")?;
            let (delta_x, delta_y) = match input["direction"].as_str() {
                Some("up") => (0, -amount * 100),
                Some("down") => (0, amount * 100),
                Some("left") => (-amount * 100, 0),
                Some("right") => (amount * 100, 0),
                _ => return Err("Invalid scroll direction".to_string()),
            };
            cdp(port, "Input.dispatchMouseEvent", json!({ "type": "mouseWheel", "x": 720, "y": 450, "deltaX": delta_x, "deltaY": delta_y })).await?;
        }
        "wait" => {
            let duration = input["durationMs"]
                .as_u64()
                .filter(|value| (100..=10_000).contains(value))
                .ok_or("Invalid browser wait")?;
            tokio::time::sleep(Duration::from_millis(duration)).await;
        }
        "read" => return page_text(port).await,
        _ => return Err("Unsupported browser action".to_string()),
    }
    observe(port).await
}

#[tauri::command]
pub async fn observe_local_browser(
    id: String,
    fence: u64,
    browsers: State<'_, LocalBrowsers>,
) -> Result<Value, String> {
    observe(browsers.authorised_port(&id, fence)?).await
}

#[tauri::command]
pub fn revoke_local_browser(
    id: String,
    fence: u64,
    browsers: State<'_, LocalBrowsers>,
) -> Result<(), String> {
    browsers.revoke(&id, fence)
}

#[tauri::command]
pub async fn stop_local_browser(
    id: String,
    fence: u64,
    browsers: State<'_, LocalBrowsers>,
) -> Result<(), String> {
    if browsers.port(&id).is_err() {
        return Ok(());
    }
    browsers.authorised_port(&id, fence)?;
    let session = browsers
        .sessions
        .lock()
        .map_err(|_| "Local browser registry is unavailable".to_string())?
        .remove(&id)
        .ok_or("This local browser is not active")?;
    LocalBrowsers::close(session).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::public_https_url;

    #[test]
    fn browser_rejects_local_and_unsafe_destinations() {
        for url in [
            "http://example.com",
            "https://localhost/private",
            "https://127.0.0.1/private",
            "https://10.0.0.1/private",
            "https://[::1]/private",
            "https://0.0.0.0/private",
            "file:///etc/passwd",
            "https://user:password@example.com",
        ] {
            assert!(public_https_url(url).is_err(), "{url}");
        }
        assert!(public_https_url("https://example.com/").is_ok());
    }
}
