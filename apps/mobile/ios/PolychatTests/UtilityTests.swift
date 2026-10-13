import Foundation
import Testing
import UniformTypeIdentifiers
@testable import Polychat

struct UtilityTests {
    @Test func responseReplayAppliesAndClearsRetryState() {
        let initial = ResponseSnapshot(
            cursor: 1,
            response: makeResponse(),
            messages: []
        )
        let retry: [String: JSONValue] = [
            "protocolVersion": .number(1),
            "step": .number(2),
            "attempt": .number(2),
            "maxAttempts": .number(2),
            "runRetry": .number(1),
            "maxRunRetries": .number(2),
            "phase": .string("waiting"),
            "classification": .string("timeout"),
            "reason": .string("The model provider did not respond in time."),
            "scheduledAt": .string("2026-09-05T12:00:02.000Z"),
            "retryAt": .string("2026-09-05T12:00:03.000Z")
        ]
        let waiting = ResponseReplay.apply(
            state: ResponseReplayState(cursor: 1, snapshot: initial),
            response: ResponseReplayResponse(
                responseId: "run-1",
                fromCursor: 1,
                nextCursor: 2,
                resetRequired: false,
                events: [ResponseEventRecord(
                    id: "event-2",
                    responseId: "run-1",
                    sequence: 2,
                    attempt: 1,
                    type: "response.retry_changed",
                    occurredAt: "2026-09-05T12:00:02.000Z",
                    data: ["retry": .object(retry)]
                )],
                snapshot: nil
            )
        )
        let cleared = ResponseReplay.apply(
            state: waiting.state,
            response: ResponseReplayResponse(
                responseId: "run-1",
                fromCursor: 2,
                nextCursor: 3,
                resetRequired: false,
                events: [ResponseEventRecord(
                    id: "event-3",
                    responseId: "run-1",
                    sequence: 3,
                    attempt: 1,
                    type: "response.retry_changed",
                    occurredAt: "2026-09-05T12:00:03.000Z",
                    data: ["retry": .null]
                )],
                snapshot: nil
            )
        )

        #expect(waiting.state.snapshot.response.retry?.phase == "waiting")
        #expect(waiting.state.snapshot.response.attempt == 1)
        #expect(cleared.state.snapshot.response.retry == nil)
    }

    @Test func responseReplayDeduplicatesOrdersAndRejectsTerminalRegression() {
        let initial = ResponseSnapshot(
            cursor: 1,
            response: makeResponse(status: "in_progress"),
            messages: []
        )
        let events = [
            makeRunEvent(sequence: 3, status: "cancelled"),
            makeRunEvent(sequence: 2, status: "cancelling"),
            makeRunEvent(sequence: 2, status: "cancelling")
        ]
        let outcome = ResponseReplay.apply(
            state: ResponseReplayState(cursor: 1, snapshot: initial),
            response: ResponseReplayResponse(
                responseId: "run-1",
                fromCursor: 1,
                nextCursor: 3,
                resetRequired: false,
                events: events,
                snapshot: nil
            )
        )

        #expect(outcome.requiresSnapshot == false)
        #expect(outcome.state.cursor == 3)
        #expect(outcome.state.snapshot.response.status == "cancelled")

        let stale = ResponseReplay.apply(
            state: outcome.state,
            response: ResponseReplayResponse(
                responseId: "run-1",
                fromCursor: 3,
                nextCursor: 4,
                resetRequired: false,
                events: [makeRunEvent(sequence: 4, status: "in_progress")],
                snapshot: nil
            )
        )

        #expect(stale.state.cursor == 4)
        #expect(stale.state.snapshot.response.status == "cancelled")
    }

    @Test func responseReplayRequestsSnapshotsForGapsAndUnknownEventsAndAcceptsResets() {
        let snapshot = ResponseSnapshot(
            cursor: 2,
            response: makeResponse(status: "in_progress"),
            messages: []
        )
        let state = ResponseReplayState(cursor: 2, snapshot: snapshot)
        let gap = ResponseReplay.apply(
            state: state,
            response: ResponseReplayResponse(
                responseId: "run-1",
                fromCursor: 2,
                nextCursor: 4,
                resetRequired: false,
                events: [makeRunEvent(sequence: 4, status: "completed")],
                snapshot: nil
            )
        )
        let unknown = ResponseReplay.apply(
            state: state,
            response: ResponseReplayResponse(
                responseId: "run-1",
                fromCursor: 2,
                nextCursor: 3,
                resetRequired: false,
                events: [makeRunEvent(sequence: 3, status: "in_progress", type: "future.event")],
                snapshot: nil
            )
        )
        let reset = ResponseReplay.apply(
            state: state,
            response: ResponseReplayResponse(
                responseId: "run-1",
                fromCursor: 0,
                nextCursor: 5,
                resetRequired: true,
                events: [],
                snapshot: ResponseSnapshot(cursor: 5, response: makeResponse(status: "completed"), messages: [])
            )
        )

        #expect(gap.requiresSnapshot)
        #expect(unknown.requiresSnapshot)
        #expect(reset.requiresSnapshot == false)
        #expect(reset.state.cursor == 5)
        #expect(reset.state.snapshot.response.status == "completed")
    }

    @Test func responsePresentationDistinguishesWaitingAndTerminalStates() {
        #expect(ResponsePresentation.resolve(makeResponse(status: "awaiting_input")).label == "Answer needed")
        #expect(ResponsePresentation.resolve(makeResponse(status: "awaiting_approval")).label == "Approval needed")
        #expect(ResponsePresentation.resolve(makeResponse(status: "awaiting_takeover")).label == "Takeover needed")
        #expect(ResponsePresentation.resolve(makeResponse(status: "cancelling")).label == "Stop requested")
        #expect(ResponsePresentation.resolve(makeResponse(status: "cancelled")).label == "Task cancelled")
        #expect(ResponsePresentation.resolve(makeResponse(status: "failed")).detail == "Provider unavailable")
        #expect(ResponsePresentation.resolve(makeResponse(status: "incomplete")).label == "Task interrupted")
    }

    @Test func responsePresentationShowsExactRetryAttempt() {
        let retry = ChatRetrySnapshot(
            protocolVersion: 1,
            step: 2,
            attempt: 2,
            maxAttempts: 2,
            runRetry: 1,
            maxRunRetries: 2,
            phase: "waiting",
            classification: "network",
            reason: "The model provider connection failed temporarily.",
            scheduledAt: "2026-09-05T12:00:00.000Z",
            retryAt: "2026-09-05T12:00:01.000Z"
        )
        let presentation = ResponsePresentation.resolve(makeResponse(retry: retry))

        #expect(presentation.label == "Retry scheduled")
        #expect(presentation.detail == "Attempt 2 of 2 · run retry 1 of 2 · The model provider connection failed temporarily.")
    }

    @Test func chatContextPresentationLabelsEstimatesAndBoundedToolOutput() {
        #expect(
            ChatContextPresentation.usageLabel(
                ChatContextUsage(inputTokens: 4200, contextWindow: 32000, source: "estimated")
            ) == "4,200 estimated tokens of 32,000"
        )
        #expect(
            ChatContextPresentation.omissionLabel(
                ChatContextOmission(
                    id: "tool-result:1",
                    kind: "tool_result",
                    reason: "bounded",
                    count: 1,
                    messageId: "message-1",
                    retrievalPath: "/chat/messages/message-1"
                )
            ) == "Tool result shortened"
        )
    }

    @Test func projectTaskActivityPresentationKeepsWaitingFailureInterruptionAndFutureKindsDistinct() {
        let waiting = ProjectTaskActivityPresentation.resolve(makeProjectTaskActivityItem())
        let failed = ProjectTaskActivityPresentation.resolve(
            makeProjectTaskActivityItem(status: "failed", title: "Tool failed", actionable: false, terminal: true)
        )
        let interrupted = ProjectTaskActivityPresentation.resolve(
            makeProjectTaskActivityItem(status: "interrupted", title: "Run interrupted", actionable: false, terminal: true)
        )
        let future = ProjectTaskActivityPresentation.resolve(
            makeProjectTaskActivityItem(
                type: "future.checkpoint",
                category: "run",
                status: "future",
                title: "Task activity",
                actionable: false
            )
        )

        #expect(waiting.statusLabel == "Waiting")
        #expect(waiting.tone == .attention)
        #expect(failed.statusLabel == "Failed")
        #expect(interrupted.statusLabel == "Interrupted")
        #expect(future.statusLabel == "Activity")
        #expect(future.systemImage == "ellipsis.circle")
    }

    @Test func dateParserAcceptsISO8601AndSQLiteTimestamps() throws {
        let isoDate = try #require(AppDateParser.parse("2026-05-25T08:30:15.123Z"))
        let sqliteDate = try #require(AppDateParser.parse("2026-05-25 08:30:15.123"))

        #expect(isoDate == sqliteDate)
        #expect(AppDateParser.parse("   ") == nil)
    }

    @Test func attachmentClassifierIdentifiesUploadTypesAndMarkdownConversion() {
        #expect(AttachmentFileClassifier.inferUploadType(mimeType: "image/png", fileName: "image.png", contentType: .png) == "image")
        #expect(AttachmentFileClassifier.inferUploadType(mimeType: "audio/mpeg", fileName: "voice.mp3", contentType: .audio) == "audio")
        #expect(AttachmentFileClassifier.inferUploadType(mimeType: "application/octet-stream", fileName: "main.swift", contentType: nil) == "code")
        #expect(AttachmentFileClassifier.inferUploadType(mimeType: "application/pdf", fileName: "brief.pdf", contentType: .pdf) == "document")

        #expect(AttachmentFileClassifier.shouldConvertToMarkdown(fileType: "document", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
        #expect(!AttachmentFileClassifier.shouldConvertToMarkdown(fileType: "document", mimeType: "application/pdf"))
        #expect(!AttachmentFileClassifier.shouldConvertToMarkdown(fileType: "code", mimeType: "text/x-swift"))
    }

    @Test func inlineArtifactParserExtractsClosedAndStreamingArtifacts() throws {
        let content = """
        Before
        <artifact identifier="chart" type="application/vnd.ant.code" language="swift" title="Chart">
        let value = 1
        </artifact>
        After <artifact identifier="draft" type="text/markdown"># Draft
        """

        let artifacts = InlineArtifactParser.artifacts(in: content)

        #expect(artifacts.count == 2)
        #expect(artifacts[0].id == "chart")
        #expect(artifacts[0].type == .code)
        #expect(artifacts[0].title == "Chart")
        #expect(artifacts[1].id == "draft")
        #expect(artifacts[1].type == .markdown)

        let replaced = InlineArtifactParser.replacingArtifacts(in: content) { artifact in
            "[artifact:\(artifact.id)]"
        }

        #expect(replaced.contains("[artifact:chart]"))
        #expect(replaced.contains("[artifact:draft]"))
        #expect(!replaced.contains("<artifact"))
    }

    @Test func markdownParserSplitsProseCodeAndTables() throws {
        let markdown = """
        Intro

        ```swift
        let value = 1
        ```

        | Feature | Status |
        | --- | --- |
        | Tables | Done |
        """

        let blocks = MarkdownBlock.blocks(from: markdown)

        #expect(blocks.count == 3)
        #expect(blocks[0].kind == .markdown)
        #expect(blocks[1].kind == .code(language: "swift"))
        #expect(blocks[1].content == "let value = 1")

        guard case .table(let table) = blocks[2].kind else {
            Issue.record("Expected table block")
            return
        }

        #expect(table.headers == ["Feature", "Status"])
        #expect(table.rows == [["Tables", "Done"]])
    }

    @Test func markdownFixerCompletesLikelyStreamingMarkdown() {
        #expect(MarkdownFixer.fix("# Title") == "## Title")
        #expect(MarkdownFixer.fix("Value is `partial").contains("`partial`"))
        #expect(MarkdownFixer.fix("```swift\nlet x = 1").hasSuffix("\n```"))
        #expect(MarkdownFixer.fix("| A | B\n| --- | --- |\n| 1 | 2", isStreaming: true).hasSuffix(" |"))
    }

    @Test func chatStreamParserHandlesPlatformEventsAndErrors() throws {
        #expect(try ChatStreamEventParser.events(from: "[DONE]") == [.done])
        #expect(try ChatStreamEventParser.events(
            from: #"{"type":"response.output_text.delta","item_id":"m1","output_index":0,"delta":"Hello","sequence_number":1}"#
        ) == [.content("Hello")])
        #expect(try ChatStreamEventParser.events(
            from: #"{"type":"response.reasoning.delta","item_id":"m1","output_index":0,"delta":"Thinking","sequence_number":2}"#
        ) == [.reasoning("Thinking")])
        #expect(try ChatStreamEventParser.events(from: #"{"type":"future.additive_event","detail":"ignored"}"#) == [])

        let metadataEvents = try ChatStreamEventParser.events(from: """
        {
            "type": "response.output_item.done",
            "output_index": 0,
            "sequence_number": 3,
            "finish_reason": "stop",
            "item": {
                "type": "message",
                "role": "assistant",
                "id": "m1",
                "status": "complete",
                "content": [{"type": "text", "text": "Final"}],
                "metadata": {"model": "gpt-4o", "log_id": "log-1"}
            }
        }
        """)
        #expect(metadataEvents.count == 1)
        guard case .metadata(let metadata) = metadataEvents[0] else {
            Issue.record("Expected stream metadata")
            return
        }
        #expect(metadata.messageId == "m1")
        #expect(metadata.model == "gpt-4o")
        #expect(metadata.content == "Final")
        #expect(metadata.status == "complete")
        #expect(metadata.logId == "log-1")
        #expect(try ChatStreamEventParser.events(
            from: #"{"type":"response.content_part.done","item_id":"m1","sequence_number":4}"#
        ) == [.done])

        do {
            _ = try ChatStreamEventParser.events(
                from: #"{"type":"response.error","error":{"message":"Nope"},"sequence_number":5}"#
            )
            Issue.record("Expected streaming error")
        } catch APIClientError.streaming(let message) {
            #expect(message == "Nope")
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test func chatStreamParserPreservesCompactedConversationItem() throws {
        let events = try ChatStreamEventParser.events(from: """
        {
            "type": "conversation.compacted",
            "sequence_number": 4,
            "item": {
                "type": "compaction",
                "id": "snapshot-1-compaction",
                "content": [{"type": "text", "text": "Context automatically compacted"}],
                "parts": [
                    {
                        "type": "compaction",
                        "status": "completed",
                        "label": "Context automatically compacted"
                    }
                ],
                "metadata": {"completion_id": "conversation-1"}
            }
        }
        """)

        guard case .compaction(let message) = events.first else {
            Issue.record("Expected compaction stream event")
            return
        }

        #expect(message.id == "snapshot-1-compaction")
        #expect(message.completionId == "conversation-1")
        #expect(message.isCompactionMarker)
        #expect(message.compactionStatusLabel == "Context automatically compacted")
    }

    @Test func chatStreamParserPreservesBareCompactionState() throws {
        let events = try ChatStreamEventParser.events(
            from: #"{"type":"response.state","state":"compaction","sequence_number":1}"#
        )

        #expect(events == [.state("compaction")])
    }

    @Test func chatStreamParserPreservesResponseLifecycleEvents() throws {
        let events = try ChatStreamEventParser.events(from: """
        {
            "type": "response.created",
            "sequence_number": 0,
            "response": {
                "object": "response",
                "id": "run-1",
                "conversation_id": "conversation-1",
                "status": "in_progress",
                "waiting_on": null,
                "attempt": 1,
                "trigger": "user",
                "initiator_user_id": 7,
                "project_id": null,
                "project_task_id": null,
                "created_at": "2026-09-05T12:00:00.000Z",
                "updated_at": "2026-09-05T12:00:00.000Z",
                "started_at": "2026-09-05T12:00:00.000Z",
                "completed_at": null,
                "terminal_reason": null,
                "last_item_id": null,
                "receipt": {
                    "idempotency_key": "command-1",
                    "kind": "turn",
                    "accepted_at": "2026-09-05T12:00:00.000Z",
                    "duplicate": false
                }
            }
        }
        """)

        guard case .response(let response) = events.first else {
            Issue.record("Expected response lifecycle event")
            return
        }

        #expect(response.receipt?.idempotencyKey == "command-1")
        #expect(response.id == "run-1")
        #expect(response.status == "in_progress")
    }

    @Test func chatStreamParserReadsConversationTitle() throws {
        let events = try ChatStreamEventParser.events(
            from: #"{"type":"conversation.title_changed","title":"Durable Object concurrency","sequence_number":2}"#
        )

        #expect(events == [.conversationTitle("Durable Object concurrency")])
    }

    @Test func chatStreamChunkParserBoundsCompleteAndPartialEvents() throws {
        var partialParser = ChatStreamEventChunkParser(maximumEventBytes: 32)
        var completeParser = ChatStreamEventChunkParser(maximumEventBytes: 32)

        do {
            _ = try partialParser.append(Data(repeating: 120, count: 33))
            Issue.record("Expected an oversized partial event to fail")
        } catch let error as ChatStreamBufferError {
            #expect(error.maximumBytes == 32)
        }

        do {
            _ = try completeParser.append(Data((String(repeating: "x", count: 33) + "\n\n").utf8))
            Issue.record("Expected an oversized completed event to fail")
        } catch let error as ChatStreamBufferError {
            #expect(error.maximumBytes == 32)
        }
    }

    @MainActor
    @Test func chatStreamProgressCoalescesBurstsAndFlushesBeforeBoundaries() {
        var updates: [ChatStreamProgressUpdate] = []
        let coalescer = ChatStreamProgressCoalescer { updates.append($0) }

        for index in 1...10_000 {
            coalescer.update(ChatStreamProgressUpdate(
                conversationId: "conversation-1",
                messageId: "message-1",
                content: "token-\(index)",
                modelId: "model-1",
                fallbackMessageId: "fallback-1"
            ))
        }

        coalescer.flush()

        #expect(updates.count == 1)
        #expect(updates.first?.content == "token-10000")

        var gate = ChatStreamResponsivenessGate()
        let yields = (1...128).filter { _ in gate.shouldYield(after: .content("x")) }

        #expect(yields.count == 2)
        #expect(gate.shouldYield(after: .done) == false)
    }

    @Test func chatStreamParserTypesToolCallLifecycle() throws {
        let start = try ChatStreamEventParser.events(
            from: #"{"type":"response.output_item.added","output_index":1,"item":{"type":"tool_call","call_id":"call-1","id":"call-1","name":"web_search"},"sequence_number":1}"#
        )
        let delta = try ChatStreamEventParser.events(
            from: #"{"type":"response.tool_call.arguments.delta","item_id":"call-1","call_id":"call-1","delta":"{\"query\":\"polychat\"}","sequence_number":2}"#
        )
        let stop = try ChatStreamEventParser.events(
            from: #"{"type":"response.output_item.done","output_index":1,"item":{"type":"tool_call","call_id":"call-1","id":"call-1","name":"web_search","arguments":{"query":"polychat"}},"sequence_number":3}"#
        )

        #expect(start == [.toolUseStart(ChatToolCallEvent(toolCallId: "call-1", name: "web_search"))])
        #expect(delta == [.toolUseDelta(
            ChatToolCallEvent(
                toolCallId: "call-1",
                parameterFragment: #"{"query":"polychat"}"#
            )
        )])
        #expect(stop == [.toolUseStop("call-1")])
    }

    @Test func chatStreamParserTypesSemanticTurnActivityAndIgnoresUnknownKinds() throws {
        let started = try ChatStreamEventParser.events(
            from: #"{"type":"response.activity","kind":"tool_execution_started","step":2,"toolCallId":"call-1","toolName":"web_search"}"#
        )
        let waiting = try ChatStreamEventParser.events(
            from: #"{"type":"response.activity","kind":"waiting_for_user","step":2,"toolCallId":"call-2","toolName":"ask_user","reason":"question"}"#
        )
        let selection = try ChatStreamEventParser.events(
            from: #"{"type":"response.activity","kind":"waiting_for_user","step":2,"toolCallId":"call-3","toolName":"select_council_members","reason":"selection"}"#
        )
        let unknown = try ChatStreamEventParser.events(
            from: #"{"type":"response.activity","kind":"future_phase","step":2}"#
        )

        #expect(started == [
            .turnActivity(.toolExecutionStarted(
                step: 2,
                toolCallId: "call-1",
                toolName: "web_search"
            ))
        ])
        #expect(waiting == [
            .turnActivity(.waitingForUser(
                step: 2,
                toolCallId: "call-2",
                toolName: "ask_user",
                reason: .question
            ))
        ])
        #expect(selection == [
            .turnActivity(.waitingForUser(
                step: 2,
                toolCallId: "call-3",
                toolName: "select_council_members",
                reason: .selection
            ))
        ])
        #expect(unknown.isEmpty)
    }

    @Test func turnActivityProjectionTracksParallelToolsWaitsAndTerminals() {
        var projection = TurnActivityProjection()

        projection.apply(.toolExecutionStarted(
            step: 1,
            toolCallId: "call-weather",
            toolName: "weather"
        ))
        projection.apply(.toolExecutionStarted(
            step: 1,
            toolCallId: "call-clock",
            toolName: "clock"
        ))
        #expect(projection.phase == .usingTools)
        #expect(projection.label == "Running 2 tools...")

        projection.apply(.toolFinished(
            step: 1,
            toolCallId: "call-weather",
            toolName: "weather",
            outcome: .failure
        ))
        #expect(projection.tools.first?.status == .failure)
        #expect(projection.tools.last?.status == .running)

        projection.apply(.waitingForUser(
            step: 1,
            toolCallId: "call-question",
            toolName: "ask_user",
            reason: .question
        ))
        #expect(projection.phase == .waiting)
        #expect(projection.requiresAction)
        #expect(projection.label == "Waiting for your answer.")

        projection.apply(.waitingForUser(
            step: 1,
            toolCallId: "call-selection",
            toolName: "select_council_members",
            reason: .selection
        ))
        #expect(projection.label == "Waiting for your selection.")

        projection.markReconnecting()
        #expect(projection.phase == .reconnecting)
        #expect(projection.label == "Reconnecting to the response...")

        projection.apply(.turnFinished(outcome: .cancelled, errorType: nil))
        #expect(projection.phase == .cancelled)
        #expect(projection.label == "Response stopped.")
    }

    @Test func sharedConformanceFixtureParsesSemanticTurnActivity() throws {
        let events = try Self.sharedConformanceEvents(named: "semantic_turn_activity_lifecycle")
        let activityEvents = events.compactMap { event -> ChatTurnActivityEvent? in
            guard case .turnActivity(let activity) = event else {
                return nil
            }
            return activity
        }

        #expect(activityEvents.count == 14)
        #expect(activityEvents.first == .turnStarted)
        #expect(activityEvents.last == .turnFinished(outcome: .completed, errorType: nil))
    }

    @Test func sharedConformanceFixtureAssemblesParallelFragmentedToolInput() throws {
        let events = try Self.sharedConformanceEvents(
            named: "parallel_tools_with_fragmented_arguments_and_mixed_results"
        )
        var activity = StreamingToolActivity()
        var updates: [StreamingToolActivity.Update] = []

        for event in events {
            switch event {
            case .toolUseStart(let toolCall):
                activity.start(toolCall)
            case .toolUseDelta(let toolCall):
                activity.applyDelta(toolCall)
            case .toolUseStop(let toolCallId):
                if let update = activity.stop(toolCallId: toolCallId, completionId: "fixture") {
                    updates.append(update)
                }
            default:
                continue
            }
        }

        let inputsByName: [String: JSONValue] = Dictionary(
            uniqueKeysWithValues: updates.compactMap { update -> (String, JSONValue)? in
                guard
                    let part = update.message.parts?.first,
                    let name = part.name,
                    let input = part.input
                else {
                    return nil
                }
                return (name, input)
            }
        )

        #expect(inputsByName["clock"] == JSONValue.object(["zone": .string("UTC")]))
        #expect(inputsByName["weather"] == JSONValue.object(["city": .string("London")]))
    }

    @Test func chatStreamParserReadsToolOutputItems() throws {
        let events = try ChatStreamEventParser.events(from: """
        {
            "type": "response.output_item.done",
            "output_index": 2,
            "sequence_number": 5,
            "item": {
                "type": "tool_output",
                "id": "message-1",
                "call_id": "call-1",
                "name": "web_search",
                "status": "success",
                "content": [{"type": "text", "text": "Three results"}],
                "data": {
                    "humanInTheLoop": {
                        "type": "question",
                        "status": "pending",
                        "interactionId": "question-1"
                    },
                    "questions": [{"id": "tone", "prompt": "Which tone?", "options": [], "allowOther": true}]
                },
                "metadata": {"log_id": "log-1", "timestamp": 1774000000}
            }
        }
        """)

        guard case .toolResult(let result) = events.first else {
            Issue.record("Expected tool result stream event")
            return
        }

        #expect(events.count == 1)
        #expect(result.id == "message-1")
        #expect(result.toolCallId == "call-1")
        #expect(result.name == "web_search")
        #expect(result.status == "success")
        #expect(result.content == .string("Three results"))
        guard case .object(let structuredData)? = result.structuredData,
              case .object(let humanInTheLoop)? = structuredData["humanInTheLoop"] else {
            Issue.record("Expected structured interaction data")
            return
        }
        #expect(humanInTheLoop["interactionId"] == .string("question-1"))
        #expect(result.logId == "log-1")
    }

    @Test func streamingToolActivityShowsToolCallThenReplacesItWithTheResult() throws {
        var activity = StreamingToolActivity()
        activity.start(ChatToolCallEvent(toolCallId: "call-1", name: "web_search"))
        activity.applyDelta(ChatToolCallEvent(
            toolCallId: "call-1",
            parameterFragment: #"{"query":"poly"#
        ))
        activity.applyDelta(ChatToolCallEvent(
            toolCallId: "call-1",
            parameterFragment: #"chat"}"#
        ))

        let startUpdate = activity.stop(toolCallId: "call-1", completionId: "conversation-1")
        let started = try #require(startUpdate)
        let toolUsePart = try #require(started.message.parts?.first)

        #expect(started.replacingMessageId == nil)
        #expect(started.message.role == "tool")
        #expect(toolUsePart.type == "tool_use")
        #expect(toolUsePart.name == "web_search")
        #expect(toolUsePart.input == .object(["query": .string("polychat")]))
        #expect(activity.interimMessageIds == [started.message.id])

        let resolveUpdate = activity.resolve(
            ChatToolResultEvent(
                id: "tool-message-1",
                toolCallId: "call-1",
                name: "web_search",
                status: "success",
                content: .string("Three results"),
                data: nil,
                logId: nil,
                model: nil,
                timestamp: nil
            ),
            completionId: "conversation-1"
        )
        let resolved = try #require(resolveUpdate)

        #expect(resolved.replacingMessageId == started.message.id)
        #expect(resolved.message.id == "tool-message-1")
        #expect(resolved.message.parts?.first?.type == "tool_result")
        #expect(activity.interimMessageIds.isEmpty)
    }

    @Test func chatStreamParserReadsUsageLimits() throws {
        let events = try ChatStreamEventParser.events(
            from: #"{"type":"response.usage_limits","usage_limits":{"credits":{"included":500,"used":125,"reserved":25,"grace":50,"overrun":0,"overage":0,"overage_enabled":false,"state":"ok"}}}"#
        )

        #expect(events == [.usageLimits(
            ChatUsageLimits(
                credits: ChatUsageLimits.Credits(
                    included: 500,
                    used: 125,
                    reserved: 25,
                    grace: 50,
                    overrun: 0,
                    overage: 0,
                    overageEnabled: false,
                    state: "ok"
                )
            )
        )])
    }
    @Test func projectTaskInteractionControlReconcilesAuthoritativeResolution() {
        let pending = makeProjectTaskDetail(interaction: makeProjectTaskInteraction())
        var control = ProjectTaskInteractionControl.reconcile(pending, previous: nil)
        #expect(control?.acceptsSubmission == true)

        control?.submission = .submitting
        let resolved = makeProjectTaskDetail(
            task: makeProjectTaskControlTask(status: "queued", blockedReason: nil),
            interaction: makeProjectTaskInteraction(status: "resolved")
        )
        control = ProjectTaskInteractionControl.reconcile(resolved, previous: control)

        #expect(control?.interaction.status == "resolved")
        #expect(control?.submission == .acknowledged)
        #expect(control?.acceptsSubmission == false)
    }

    @Test func projectTaskInteractionControlTreatsExternalResolutionAndUnknownKindsSafely() {
        let pending = ProjectTaskInteractionControl.reconcile(
            makeProjectTaskDetail(interaction: makeProjectTaskInteraction()),
            previous: nil
        )
        let resolved = ProjectTaskInteractionControl.reconcile(
            makeProjectTaskDetail(
                task: makeProjectTaskControlTask(status: "running", blockedReason: nil),
                interaction: makeProjectTaskInteraction(status: "resolved")
            ),
            previous: pending
        )

        #expect(resolved?.submission == .resolvedElsewhere)

        let unknown = makeProjectTaskInteraction(type: "future-decision", questions: nil)
        let unknownControl = ProjectTaskInteractionControl.reconcile(
            makeProjectTaskDetail(interaction: unknown),
            previous: nil
        )
        #expect(unknownControl?.interaction.isSupported == false)
        #expect(unknownControl?.acceptsSubmission == false)

        let newerProtocol = ProjectTaskInteractionControl.reconcile(
            makeProjectTaskDetail(
                interaction: makeProjectTaskInteraction(protocolVersion: 2)
            ),
            previous: nil
        )
        #expect(newerProtocol?.interaction.isSupported == false)
        #expect(newerProtocol?.acceptsSubmission == false)
    }

    @Test func connectorApprovalCandidateKeepsStructuredExactRunIdentity() {
        let run = makeResponse(status: "awaiting_approval")
        let candidate = ConnectorApprovalCandidate.latest(
            in: [makeConnectorApprovalMessage()],
            response: run
        )

        #expect(candidate == ConnectorApprovalCandidate(
            approvalId: "coa_action",
            runId: "run-1",
            completionId: "conversation-1",
            provider: "gmail",
            operation: "GMAIL_SEND_EMAIL"
        ))

        let successor = PlatformResponse(
            id: "run-2",
            conversationId: "conversation-1",
            status: "awaiting_approval",
            attempt: 1,
            initiatorUserId: 7,
            createdAt: "2026-09-05T12:05:00.000Z",
            updatedAt: "2026-09-05T12:05:00.000Z"
        )
        #expect(ConnectorApprovalCandidate.latest(
            in: [makeConnectorApprovalMessage()],
            response: successor
        ) == nil)
    }

    @Test func connectorApprovalControlDistinguishesAcknowledgedAndExternalResolution() {
        var submitting = ConnectorApprovalControl(
            approval: makeConnectorApproval(),
            submission: .submitting
        )
        submitting = ConnectorApprovalControl.reconcile(
            makeConnectorApproval(state: "approved"),
            previous: submitting
        )
        #expect(submitting.submission == .acknowledged)

        let pending = ConnectorApprovalControl(approval: makeConnectorApproval(), submission: .idle)
        let external = ConnectorApprovalControl.reconcile(
            makeConnectorApproval(state: "rejected"),
            previous: pending
        )
        #expect(external.submission == .resolvedElsewhere)
        #expect(external.acceptsResolution == false)
    }
}

private func makeRunEvent(
    sequence: Int,
    status: String,
    type: String = "response.status_changed"
) -> ResponseEventRecord {
    ResponseEventRecord(
        id: "event-\(sequence)",
        responseId: "run-1",
        sequence: sequence,
        attempt: 1,
        type: type,
        occurredAt: "2026-09-05T12:00:0\(sequence).000Z",
        data: ["status": .string(status)]
    )
}

extension UtilityTests {
    @Test func responseUsagePresentationDoesNotPresentUnknownConsumptionAsZero() throws {
        let run = try JSONDecoder().decode(PlatformResponse.self, from: Data("""
        {
            "object": "response", "id": "run-1", "conversation_id": "conversation-1",
            "status": "in_progress", "waiting_on": null, "attempt": 1, "trigger": "user",
            "initiator_user_id": 7, "project_id": null, "project_task_id": null,
            "created_at": "2026-09-05T10:00:00.000Z", "updated_at": "2026-09-05T10:00:00.000Z",
            "started_at": null, "completed_at": null, "terminal_reason": null, "last_item_id": null,
            "usage": {
                "protocolVersion": 1, "runId": "run-1", "currentAttempt": 1,
                "measurement": "unknown", "reservation": null,
                "consumption": { "status": "unknown", "eventCount": 0, "costMicros": null,
                    "creditMicros": null, "estimatedPriceEventCount": 0, "bySource": [] },
                "attempts": [], "settlement": { "status": "released", "at": null }
            }
        }
        """.utf8))
        let usage = try #require(run.usage)

        #expect(ResponseUsagePresentation.summary(usage) == "unknown usage · consumption unknown · released")
    }

    @Test func outputReviewDeepLinksAcceptNativeAndWebPaths() throws {
        let native = try #require(URL(string: "polychat://outputs/output-1"))
        let web = try #require(URL(string: "https://app.example/responses/output-2"))

        #expect(OutputReviewDeepLink.outputId(from: native) == "output-1")
        #expect(OutputReviewDeepLink.outputId(from: web) == "output-2")
        #expect(OutputReviewDeepLink.outputId(from: URL(string: "polychat://chat/new")!) == nil)
    }

    @Test func outputRevisionPresentationSummarisesChangesAndEffectiveOrigin() throws {
        let data = Data("""
        {
            "current": {
                "outputId": "output-1", "revision": 2, "parentRevision": 1,
                "title": "Current", "status": "ready", "sensitivity": "personal",
                "content": { "body": "Current" }, "createdByUserId": 42,
                "createdAt": "2026-09-05T13:00:00.000Z", "operation": "updated",
                "restoredFromRevision": null,
                "provenance": {
                    "protocolVersion": 1, "capturedAt": "2026-09-05T12:00:00.000Z",
                    "completeness": "complete", "origin": "generated",
                    "run": { "id": "run-1", "attempt": 2 },
                    "model": { "id": "model-1", "provider": "provider-1" },
                    "skills": [], "sources": [], "approvals": []
                }
            },
            "revisions": [{
                "outputId": "output-1", "revision": 1, "parentRevision": null,
                "title": "Earlier", "status": "ready", "sensitivity": "personal",
                "content": { "body": "Earlier" }, "createdByUserId": 42,
                "createdAt": "2026-09-05T12:00:00.000Z", "operation": "created",
                "restoredFromRevision": null,
                "provenance": {
                    "protocolVersion": 1, "capturedAt": "2026-09-05T12:00:00.000Z",
                    "completeness": "complete", "origin": "generated",
                    "run": { "id": "run-1", "attempt": 2 },
                    "model": { "id": "model-1", "provider": "provider-1" },
                    "skills": [], "sources": [], "approvals": []
                }
            }],
            "restore": { "supported": true, "reason": null, "fields": ["title", "content"] }
        }
        """.utf8)
        let history = try JSONDecoder().decode(OutputHistoryResponse.self, from: data)
        let selected = try #require(history.revisions.first)

        #expect(
            OutputRevisionPresentation.changedFields(current: history.current, selected: selected)
                == ["Title", "Content"]
        )
        #expect(
            OutputRevisionPresentation.provenanceLabel(selected.provenance)
                == "model-1 via provider-1 · Run run-1, attempt 2"
        )
    }
    private static func sharedConformanceEvents(named name: String) throws -> [ChatStreamEvent] {
        let sourceFile = URL(fileURLWithPath: #filePath)
        let repositoryRoot = sourceFile
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let fixtureURL = repositoryRoot
            .appendingPathComponent("packages/schemas/fixtures/chat-stream-conformance.json")
        let fixtureData = try Data(contentsOf: fixtureURL)
        let root = try #require(
            try JSONSerialization.jsonObject(with: fixtureData) as? [String: Any]
        )
        let cases = try #require(root["cases"] as? [[String: Any]])
        let fixture = try #require(cases.first { $0["name"] as? String == name })
        let chunks = try #require(fixture["chunks"] as? [String])
        var parser = ChatStreamEventChunkParser()
        var events: [ChatStreamEvent] = []

        for chunk in chunks {
            events.append(contentsOf: try parser.append(Data(chunk.utf8)))
        }
        events.append(contentsOf: try parser.finish())

        return events
    }
}
