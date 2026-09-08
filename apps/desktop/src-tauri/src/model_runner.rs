use crate::chat::{ModelRunRequest, StreamChunk};
use crate::lines::LineReader;
use crate::runs::{RunRegistry, StreamEvent};
use crate::store::Store;
use crate::{
    authorised_endpoint, chat, next_piece, streaming_client, timestamp, transport_failure,
    with_pairing,
};

pub async fn stream_lines(
    response: reqwest::Response,
    run_id: &str,
    label: &str,
    registry: &RunRegistry,
    mut parse: impl FnMut(&str) -> StreamChunk,
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
            Some(Err(cause)) => {
                emit(StreamEvent::Failed {
                    run_id: run_id.to_string(),
                    failure: "unknown".to_string(),
                    message: transport_failure(label, &cause),
                });

                return "interrupted";
            }
            None => {
                emit(StreamEvent::Failed {
                    run_id: run_id.to_string(),
                    failure: "unknown".to_string(),
                    message: "The runtime disconnected before completing its reply.".to_string(),
                });
                return "interrupted";
            }
        };

        reader.push(&piece);

        if reader.overflowed() {
            emit(StreamEvent::Failed {
                run_id: run_id.to_string(),
                failure: "unknown".to_string(),
                message: "The runtime sent a single line too large to read.".to_string(),
            });

            return "interrupted";
        }

        while let Some(line) = reader.next_line() {
            match parse(&line) {
                StreamChunk::Text(delta) => emit(StreamEvent::Text {
                    run_id: run_id.to_string(),
                    delta,
                }),
                StreamChunk::FinalText(delta) => {
                    emit(StreamEvent::Text {
                        run_id: run_id.to_string(),
                        delta,
                    });
                    return "complete";
                }
                StreamChunk::Failed(message) => {
                    emit(StreamEvent::Failed {
                        run_id: run_id.to_string(),
                        failure: "unknown".to_string(),
                        message,
                    });
                    return "interrupted";
                }
                StreamChunk::Done => return "complete",
                StreamChunk::Ignored => {}
            }
        }
    }
}

pub async fn run_model(
    run_id: String,
    request: ModelRunRequest,
    registry: &RunRegistry,
    store: &Store,
    emit: impl Fn(StreamEvent),
) -> Result<(), String> {
    let (endpoint, base) = authorised_endpoint(store, &request.endpoint_id)?;
    let target = base
        .join(chat::chat_path(&endpoint))
        .map_err(|cause| cause.to_string())?;
    let attempt = with_pairing(
        streaming_client()?
            .post(target)
            .json(&chat::chat_body(&endpoint, &request)),
        &endpoint,
    )?;

    registry.begin(&run_id);

    emit(StreamEvent::Started {
        run_id: run_id.clone(),
        endpoint_id: endpoint.id.clone(),
        at: timestamp(),
        head: None,
    });
    emit(StreamEvent::Progress {
        run_id: run_id.clone(),
        state: "loading-model".to_string(),
    });

    let response = match attempt.send().await {
        Ok(response) => response,
        Err(cause) => {
            registry.forget(&run_id);
            emit(StreamEvent::Failed {
                run_id: run_id.clone(),
                failure: "not-running".to_string(),
                message: transport_failure(&endpoint.label, &cause),
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
        &endpoint.label,
        registry,
        |line| chat::parse_stream_line(&endpoint, line),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::egress::{DesktopEndpoint, EndpointKind, EndpointTransport};
    use std::sync::Mutex;

    #[tokio::test]
    #[ignore = "requires a running Ollama with gemma3:1b installed"]
    async fn live_ollama_discovery_and_native_reply() {
        let store = Store::open(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        let endpoint = DesktopEndpoint {
            id: "live-ollama".into(),
            kind: EndpointKind::Model,
            vendor: "ollama".into(),
            label: "Ollama".into(),
            url: "http://127.0.0.1:11434".into(),
            transport: EndpointTransport::Loopback,
            pairing_secret_stored: false,
            approved_at: timestamp(),
            last_seen_at: None,
        };
        store.save_endpoint(&endpoint).unwrap();
        let (_, base) = authorised_endpoint(&store, &endpoint.id).unwrap();
        let response = crate::http_client(crate::DISCOVERY_TIMEOUT)
            .unwrap()
            .get(base.join(crate::discovery::models_path(&endpoint)).unwrap())
            .send()
            .await
            .unwrap();
        assert!(response.status().is_success());
        let body = crate::read_bounded_json(response, "Ollama").await.unwrap();
        let models = crate::discovery::parse_models(&endpoint, &body, &timestamp());
        assert!(models.iter().any(|model| model.native_id == "gemma3:1b"));
        let events = Mutex::new(Vec::new());
        let request = ModelRunRequest {
            endpoint_id: endpoint.id,
            native_model_id: "gemma3:1b".into(),
            messages: vec![crate::chat::ChatMessage {
                role: "user".into(),
                content: "What is 2 + 2? Reply with only the number.".into(),
            }],
            max_output_tokens: Some(32),
        };
        tokio::time::timeout(
            std::time::Duration::from_secs(90),
            run_model(
                "live-run".into(),
                request,
                &RunRegistry::default(),
                &store,
                |event| events.lock().unwrap().push(event),
            ),
        )
        .await
        .unwrap()
        .unwrap();
        let events = events.lock().unwrap();
        let text: String = events
            .iter()
            .filter_map(|event| match event {
                StreamEvent::Text { delta, .. } => Some(delta.as_str()),
                _ => None,
            })
            .collect();
        assert!(
            text.contains('4') || text.to_lowercase().contains("four"),
            "The real model returned: {text}"
        );
        assert!(events.iter().any(
            |event| matches!(event, StreamEvent::Finished { reason, .. } if reason == "complete")
        ));
        assert!(!events
            .iter()
            .any(|event| matches!(event, StreamEvent::Failed { .. })));
    }
}
