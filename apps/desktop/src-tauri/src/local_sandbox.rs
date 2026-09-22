use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;

use crate::programs::resolve_program;

const IMAGE: &str = "docker.io/cloudflare/sandbox:0.12.9-python";
const MAX_OUTPUT_BYTES: usize = 1_000_000;
const MAX_COMMAND_TIMEOUT_MS: u64 = 600_000;

#[derive(Default)]
pub struct LocalSandboxes {
    ports: Mutex<HashMap<String, u16>>,
}

impl LocalSandboxes {
    fn insert(&self, id: String, port: u16) -> Result<(), String> {
        self.ports
            .lock()
            .map_err(|_| "Local sandbox registry is unavailable".to_string())?
            .insert(id, port);
        Ok(())
    }

    fn port(&self, id: &str) -> Result<u16, String> {
        self.ports
            .lock()
            .map_err(|_| "Local sandbox registry is unavailable".to_string())?
            .get(id)
            .copied()
            .ok_or_else(|| "This local sandbox is not active".to_string())
    }

    fn remove(&self, id: &str) -> Result<bool, String> {
        Ok(self
            .ports
            .lock()
            .map_err(|_| "Local sandbox registry is unavailable".to_string())?
            .remove(id)
            .is_some())
    }

    pub async fn stop_all(&self) {
        let ids = match self.ports.lock() {
            Ok(mut ports) => ports.drain().map(|(id, _)| id).collect::<Vec<_>>(),
            Err(_) => return,
        };

        for id in ids {
            let _ = docker(&["rm", "-f", &id], Duration::from_secs(15)).await;
        }
    }
}

async fn read_limited(mut reader: impl AsyncRead + Unpin) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    let mut chunk = [0_u8; 8192];

    loop {
        let read = reader
            .read(&mut chunk)
            .await
            .map_err(|error| error.to_string())?;
        if read == 0 {
            return Ok(output);
        }
        if output.len() + read > MAX_OUTPUT_BYTES {
            return Err("The sandbox command produced too much output".to_string());
        }
        output.extend_from_slice(&chunk[..read]);
    }
}

struct DockerOutput {
    success: bool,
    stdout: String,
    stderr: String,
}

async fn docker(args: &[&str], timeout: Duration) -> Result<DockerOutput, String> {
    let mut child = Command::new(resolve_program("docker"))
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| format!("Docker is unavailable: {error}"))?;
    let stdout = child.stdout.take().ok_or("Docker output is unavailable")?;
    let stderr = child.stderr.take().ok_or("Docker errors are unavailable")?;
    let result = tokio::time::timeout(timeout, async {
        let (stdout, stderr) = tokio::try_join!(read_limited(stdout), read_limited(stderr))?;
        let status = child.wait().await.map_err(|error| error.to_string())?;

        Ok::<_, String>(DockerOutput {
            success: status.success(),
            stdout: String::from_utf8_lossy(&stdout).into_owned(),
            stderr: String::from_utf8_lossy(&stderr).into_owned(),
        })
    })
    .await;

    match result {
        Ok(output) => output,
        Err(_) => {
            let _ = child.kill().await;
            Err("The sandbox command timed out".to_string())
        }
    }
}

#[tauri::command]
pub async fn local_sandbox_available() -> bool {
    docker(
        &["info", "--format", "{{.ServerVersion}}"],
        Duration::from_secs(10),
    )
    .await
    .map(|output| output.success)
    .unwrap_or(false)
}

#[tauri::command]
pub async fn start_local_sandbox(sandboxes: State<'_, LocalSandboxes>) -> Result<String, String> {
    let output = docker(
        &[
            "run",
            "--detach",
            "--rm",
            "--network",
            "bridge",
            "--publish",
            "127.0.0.1::3000",
            "--memory",
            "2g",
            "--cpus",
            "2",
            "--pids-limit",
            "512",
            "--label",
            "app=polychat-local-sandbox",
            "--security-opt",
            "no-new-privileges",
            "--workdir",
            "/workspace",
            IMAGE,
        ],
        Duration::from_secs(180),
    )
    .await?;

    if !output.success {
        return Err(output.stderr.trim().to_string());
    }

    let id = output.stdout.trim().to_string();
    if id.len() != 64 || !id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Docker returned an invalid container identifier".to_string());
    }
    let published = docker(&["port", &id, "3000/tcp"], Duration::from_secs(10)).await?;
    let port = published
        .stdout
        .trim()
        .rsplit(':')
        .next()
        .and_then(|value| value.parse::<u16>().ok())
        .filter(|port| *port > 0);
    let Some(port) = port else {
        let _ = docker(&["rm", "-f", &id], Duration::from_secs(15)).await;
        return Err("Docker did not expose the sandbox control port".to_string());
    };
    if let Err(error) = sandboxes.insert(id.clone(), port) {
        let _ = docker(&["rm", "-f", &id], Duration::from_secs(15)).await;
        return Err(error);
    }
    Ok(id)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSandboxHttpRequest {
    id: String,
    path: String,
    method: String,
    body: Option<String>,
    content_type: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSandboxHttpResponse {
    status: u16,
    body: String,
    content_type: Option<String>,
}

#[tauri::command]
pub async fn request_local_sandbox(
    request: LocalSandboxHttpRequest,
    sandboxes: State<'_, LocalSandboxes>,
) -> Result<LocalSandboxHttpResponse, String> {
    let port = sandboxes.port(&request.id)?;
    if !request.path.starts_with('/') || request.path.starts_with("//") {
        return Err("Invalid sandbox request path".to_string());
    }
    if request
        .body
        .as_ref()
        .is_some_and(|body| body.len() > MAX_OUTPUT_BYTES)
    {
        return Err("The sandbox request is too large".to_string());
    }
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| "Invalid sandbox request method".to_string())?;
    if !matches!(
        method,
        reqwest::Method::GET
            | reqwest::Method::POST
            | reqwest::Method::DELETE
            | reqwest::Method::PUT
            | reqwest::Method::PATCH
    ) {
        return Err("Unsupported sandbox request method".to_string());
    }

    let url = format!("http://127.0.0.1:{port}{}", request.path);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(MAX_COMMAND_TIMEOUT_MS))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| error.to_string())?;
    let mut outbound = client.request(method, url);
    if let Some(content_type) = request.content_type {
        if content_type != "application/json" {
            return Err("Unsupported sandbox request content type".to_string());
        }
        outbound = outbound.header(reqwest::header::CONTENT_TYPE, content_type);
    }
    if let Some(body) = request.body {
        outbound = outbound.body(body);
    }
    let response = outbound.send().await.map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|header| header.to_str().ok())
        .map(str::to_string);
    let mut body = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(piece) = stream.next().await {
        let piece = piece.map_err(|error| error.to_string())?;
        if body.len() + piece.len() > MAX_OUTPUT_BYTES {
            return Err("The sandbox response is too large".to_string());
        }
        body.extend_from_slice(&piece);
    }

    Ok(LocalSandboxHttpResponse {
        status,
        body: String::from_utf8(body)
            .map_err(|_| "The sandbox response is not text".to_string())?,
        content_type,
    })
}

#[tauri::command]
pub async fn stop_local_sandbox(
    id: String,
    sandboxes: State<'_, LocalSandboxes>,
) -> Result<(), String> {
    sandboxes.port(&id)?;
    let output = docker(&["rm", "-f", &id], Duration::from_secs(15)).await?;
    if output.success {
        sandboxes.remove(&id)?;
        Ok(())
    } else {
        Err(output.stderr.trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::LocalSandboxes;

    #[test]
    fn accepts_only_registered_containers() {
        let sandboxes = LocalSandboxes::default();
        assert!(sandboxes.port("unknown").is_err());
        sandboxes.insert("owned".to_string(), 3000).unwrap();
        assert_eq!(sandboxes.port("owned").unwrap(), 3000);
        assert!(sandboxes.remove("owned").unwrap());
        assert!(sandboxes.port("owned").is_err());
    }
}
