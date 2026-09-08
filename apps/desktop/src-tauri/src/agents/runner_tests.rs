use super::*;
use std::sync::{Arc, Mutex};
use tauri::ipc::InvokeResponseBody;

#[tokio::test]
async fn native_process_boundary_streams_failures_and_cancels_silent_processes() {
    let path =
        std::env::temp_dir().join(format!("polychat-process-fixture-{}", std::process::id()));
    std::fs::create_dir_all(&path).unwrap();
    let directories = DirectoryGrants::default();
    let grant = directories.add(&path).unwrap();
    let store = Store::open(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
    store.save_agent_directory(&grant).unwrap();
    let registry = Arc::new(RunRegistry::default());

    for (driver, permission, script, cancelled, expected, output) in [
        ("claude-code", "supervised", "printf '%s\\n' '{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"text\",\"text\":\"Fixture reply\"}]}}'", false, "complete", "Fixture reply"),
        ("claude-code", "supervised", "exit 1", false, "interrupted", ""),
        ("claude-code", "supervised", "exec sleep 60", true, "cancelled", ""),
        ("opencode", "supervised", "printf '%s\\n' \"$OPENCODE_PERMISSION\"", false, "complete", "ask"),
        ("opencode", "auto", "printf '%s\\n' \"$OPENCODE_PERMISSION\"", false, "complete", "allow"),
    ] {
        let events = Arc::new(Mutex::new(Vec::new()));
        let captured = events.clone();
        let cancellation = registry.clone();
        let channel = Channel::<StreamEvent>::new(move |body| {
            if let InvokeResponseBody::Json(body) = body {
                let event: serde_json::Value = serde_json::from_str(&body).unwrap();
                if cancelled && event["type"] == "started" {
                    cancellation.cancel("fixture-run");
                }
                captured.lock().unwrap().push(event);
            }
            Ok(())
        });
        let request: ProcessRunRequest = serde_json::from_value(serde_json::json!({
            "driver": driver, "directoryId": grant.id,
            "prompt": "Fixture turn", "session": null, "permissionMode": permission,
            "model": null, "acknowledgeDirty": false,
        })).unwrap();
        let mut command = Command::new("/bin/sh");
        command.args(["-c", script]);
        tokio::time::timeout(std::time::Duration::from_secs(5),
            run_command("fixture-run".into(), request, channel, &directories, &registry, &store, command)
        ).await.unwrap().unwrap();
        let events = events.lock().unwrap();
        assert!(events.iter().any(|event| event["type"] == "finished" && event["reason"] == expected));
        if expected == "complete" {
            assert!(events.iter().any(|event| event["type"] == "rawOutput" && event["data"].as_str().is_some_and(|line| line.contains(output))));
        }
        assert!(registry.acquire_directory(&path, "next-run").is_some());
    }
    std::fs::remove_dir_all(path).unwrap();
}
