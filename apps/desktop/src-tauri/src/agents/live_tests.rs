use super::{
    process::{AgentDriver, DirectoryGrants, PermissionMode, ProcessRunRequest},
    runner,
};
use crate::{
    runs::{RunRegistry, StreamEvent},
    store::Store,
};
use std::sync::{Arc, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};

#[tokio::test]
#[ignore = "requires an installed and signed-in Claude Code CLI"]
async fn live_claude_process_produces_an_assistant_reply() {
    let path = std::env::temp_dir().join(format!("polychat-agent-{}", std::process::id()));
    std::fs::create_dir_all(&path).unwrap();
    let directories = DirectoryGrants::default();
    let grant = directories.add(&path).unwrap();
    let store = Store::open(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
    store.save_agent_directory(&grant).unwrap();
    let events = Arc::new(Mutex::new(Vec::new()));
    let captured = events.clone();
    let channel = Channel::<StreamEvent>::new(move |body| {
        if let InvokeResponseBody::Json(body) = body {
            captured
                .lock()
                .unwrap()
                .push(serde_json::from_str::<serde_json::Value>(&body).unwrap());
        }
        Ok(())
    });
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(90),
        runner::run(
            "live-agent".into(),
            ProcessRunRequest {
                driver: AgentDriver::ClaudeCode,
                directory_id: grant.id,
                prompt: "What is 2 + 2? Reply with only the number. Do not use any tools.".into(),
                session: None,
                permission_mode: PermissionMode::Supervised,
                model: None,
                acknowledge_dirty: false,
            },
            channel,
            &directories,
            &RunRegistry::default(),
            &store,
        ),
    )
    .await;
    std::fs::remove_dir_all(path).unwrap();
    result.unwrap().unwrap();
    let events = events.lock().unwrap();
    assert!(events
        .iter()
        .any(|event| event["type"] == "finished" && event["reason"] == "complete"));
    let has_reply = events
        .iter()
        .filter_map(|event| event["data"].as_str())
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .any(|event| {
            event["type"] == "assistant"
                && event["message"]["content"].as_array().is_some_and(|parts| {
                    parts.iter().any(|part| {
                        part["type"] == "text"
                            && part["text"].as_str().is_some_and(|text| text.trim() == "4")
                    })
                })
        });
    assert!(
        has_reply,
        "No assistant answer arrived from the real Claude process"
    );
}
