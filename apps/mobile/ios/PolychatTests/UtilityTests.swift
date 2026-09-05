import Foundation
import Testing
import UniformTypeIdentifiers
@testable import Polychat

struct UtilityTests {
    @Test func chatRunReplayAppliesAndClearsRetryState() {
        let initial = ChatRunSnapshotResponse(
            protocolVersion: 1,
            cursor: 1,
            run: makeChatRun(),
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
        let waiting = ChatRunReplay.apply(
            state: ChatRunReplayState(cursor: 1, snapshot: initial),
            response: ChatRunReplayResponse(
                protocolVersion: 1,
                runId: "run-1",
                fromCursor: 1,
                nextCursor: 2,
                resetRequired: false,
                events: [ChatRunEvent(
                    protocolVersion: 1,
                    id: "event-2",
                    runId: "run-1",
                    sequence: 2,
                    attempt: 1,
                    type: "run.retry_changed",
                    occurredAt: "2026-09-05T12:00:02.000Z",
                    data: ["retry": .object(retry)]
                )],
                snapshot: nil
            )
        )
        let cleared = ChatRunReplay.apply(
            state: waiting.state,
            response: ChatRunReplayResponse(
                protocolVersion: 1,
                runId: "run-1",
                fromCursor: 2,
                nextCursor: 3,
                resetRequired: false,
                events: [ChatRunEvent(
                    protocolVersion: 1,
                    id: "event-3",
                    runId: "run-1",
                    sequence: 3,
                    attempt: 1,
                    type: "run.retry_changed",
                    occurredAt: "2026-09-05T12:00:03.000Z",
                    data: ["retry": .null]
                )],
                snapshot: nil
            )
        )

        #expect(waiting.state.snapshot.run.retry?.phase == "waiting")
        #expect(waiting.state.snapshot.run.attempt == 1)
        #expect(cleared.state.snapshot.run.retry == nil)
    }

    @Test func chatRunReplayDeduplicatesOrdersAndRejectsTerminalRegression() {
        let initial = ChatRunSnapshotResponse(
            protocolVersion: 1,
            cursor: 1,
            run: makeChatRun(status: "running"),
            messages: []
        )
        let events = [
            makeRunEvent(sequence: 3, status: "cancelled"),
            makeRunEvent(sequence: 2, status: "cancelling"),
            makeRunEvent(sequence: 2, status: "cancelling")
        ]
        let outcome = ChatRunReplay.apply(
            state: ChatRunReplayState(cursor: 1, snapshot: initial),
            response: ChatRunReplayResponse(
                protocolVersion: 1,
                runId: "run-1",
                fromCursor: 1,
                nextCursor: 3,
                resetRequired: false,
                events: events,
                snapshot: nil
            )
        )

        #expect(outcome.requiresSnapshot == false)
        #expect(outcome.state.cursor == 3)
        #expect(outcome.state.snapshot.run.status == "cancelled")

        let stale = ChatRunReplay.apply(
            state: outcome.state,
            response: ChatRunReplayResponse(
                protocolVersion: 1,
                runId: "run-1",
                fromCursor: 3,
                nextCursor: 4,
                resetRequired: false,
                events: [makeRunEvent(sequence: 4, status: "running")],
                snapshot: nil
            )
        )

        #expect(stale.state.cursor == 4)
        #expect(stale.state.snapshot.run.status == "cancelled")
    }

    @Test func chatRunReplayRequestsSnapshotsForGapsUnknownEventsAndNewerProtocols() {
        let snapshot = ChatRunSnapshotResponse(
            protocolVersion: 1,
            cursor: 2,
            run: makeChatRun(status: "running"),
            messages: []
        )
        let state = ChatRunReplayState(cursor: 2, snapshot: snapshot)
        let gap = ChatRunReplay.apply(
            state: state,
            response: ChatRunReplayResponse(
                protocolVersion: 1,
                runId: "run-1",
                fromCursor: 2,
                nextCursor: 4,
                resetRequired: false,
                events: [makeRunEvent(sequence: 4, status: "succeeded")],
                snapshot: nil
            )
        )
        let unknown = ChatRunReplay.apply(
            state: state,
            response: ChatRunReplayResponse(
                protocolVersion: 1,
                runId: "run-1",
                fromCursor: 2,
                nextCursor: 3,
                resetRequired: false,
                events: [makeRunEvent(sequence: 3, status: "running", type: "future.event")],
                snapshot: nil
            )
        )
        let future = ChatRunReplay.apply(
            state: state,
            response: ChatRunReplayResponse(
                protocolVersion: 2,
                runId: "run-1",
                fromCursor: 2,
                nextCursor: 2,
                resetRequired: false,
                events: [],
                snapshot: nil
            )
        )

        #expect(gap.requiresSnapshot)
        #expect(unknown.requiresSnapshot)
        #expect(unknown.unsupportedProtocol == false)
        #expect(future.requiresSnapshot)
        #expect(future.unsupportedProtocol)
    }

    @Test func chatRunPresentationDistinguishesWaitingAndTerminalStates() {
        #expect(ChatRunPresentation.resolve(makeChatRun(status: "awaiting_input")).label == "Answer needed")
        #expect(ChatRunPresentation.resolve(makeChatRun(status: "awaiting_approval")).label == "Approval needed")
        #expect(ChatRunPresentation.resolve(makeChatRun(status: "cancelling")).label == "Stop requested")
        #expect(ChatRunPresentation.resolve(makeChatRun(status: "cancelled")).label == "Task cancelled")
        #expect(ChatRunPresentation.resolve(makeChatRun(status: "failed")).detail == "Provider unavailable")
        #expect(ChatRunPresentation.resolve(makeChatRun(status: "interrupted")).label == "Task interrupted")
    }

    @Test func chatRunPresentationShowsExactRetryAttempt() {
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
        let presentation = ChatRunPresentation.resolve(makeChatRun(retry: retry))

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

    @Test func chatStreamParserHandlesProviderShapesAndErrors() throws {
        #expect(try ChatStreamEventParser.events(from: "[DONE]") == [.done])
        #expect(try ChatStreamEventParser.events(from: #"{"type":"content_block_delta","delta":{"text":"Hello"}}"#) == [.content("Hello")])
        #expect(try ChatStreamEventParser.events(from: #"{"candidates":[{"content":{"parts":[{"text":"A"},{"text":"B"}]}}]}"#) == [.content("AB")])

        let metadataEvents = try ChatStreamEventParser.events(from: #"{"type":"message_delta","message_id":"m1","model":"gpt-4o","content":"Final"}"#)
        #expect(metadataEvents.count == 2)
        guard case .metadata(let metadata) = metadataEvents[0] else {
            Issue.record("Expected stream metadata")
            return
        }
        #expect(metadata.messageId == "m1")
        #expect(metadata.model == "gpt-4o")
        #expect(metadata.content == "Final")
        #expect(metadataEvents[1] == .done)

        do {
            _ = try ChatStreamEventParser.events(from: #"{"type":"error","error":{"message":"Nope"}}"#)
            Issue.record("Expected streaming error")
        } catch APIClientError.streaming(let message) {
            #expect(message == "Nope")
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test func chatStreamParserPreservesCompactionStateMessage() throws {
        let events = try ChatStreamEventParser.events(from: """
        {
            "type": "state",
            "state": "compaction",
            "message": {
                "id": "snapshot-1-compaction",
                "completion_id": "conversation-1",
                "role": "compaction",
                "content": "Context automatically compacted",
                "parts": [
                    {
                        "type": "compaction",
                        "status": "completed",
                        "label": "Context automatically compacted"
                    }
                ]
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
        let events = try ChatStreamEventParser.events(from: #"{"type":"state","state":"compaction"}"#)

        #expect(events == [.state("compaction")])
    }

    @Test func chatStreamParserPreservesRunReceipts() throws {
        let events = try ChatStreamEventParser.events(from: """
        {
            "type": "state",
            "state": "run",
            "receipt": {
                "protocolVersion": 1,
                "commandId": "command-1",
                "kind": "turn",
                "acceptedAt": "2026-09-05T12:00:00.000Z",
                "duplicate": false,
                "run": {
                    "protocolVersion": 1,
                    "id": "run-1",
                    "conversationId": "conversation-1",
                    "projectId": null,
                    "projectTaskId": null,
                    "initiatorUserId": 7,
                    "status": "running",
                    "attempt": 1,
                    "createdAt": "2026-09-05T12:00:00.000Z",
                    "updatedAt": "2026-09-05T12:00:00.000Z",
                    "startedAt": "2026-09-05T12:00:00.000Z",
                    "completedAt": null,
                    "terminalReason": null,
                    "lastMessageId": null
                }
            }
        }
        """)

        guard case .run(let receipt) = events.first else {
            Issue.record("Expected run receipt")
            return
        }

        #expect(receipt.commandId == "command-1")
        #expect(receipt.run.id == "run-1")
        #expect(receipt.run.status == "running")
    }

    @Test func chatStreamParserReadsConversationTitle() throws {
        let events = try ChatStreamEventParser.events(
            from: #"{"type":"state","state":"conversation_title","title":"Durable Object concurrency"}"#
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
            from: #"{"type":"tool_use_start","tool_id":"call-1","tool_name":"web_search"}"#
        )
        let delta = try ChatStreamEventParser.events(
            from: #"{"type":"tool_use_delta","tool_id":"call-1","parameters":"{\"query\":\"polychat\"}"}"#
        )
        let stop = try ChatStreamEventParser.events(from: #"{"type":"tool_use_stop","tool_id":"call-1"}"#)

        #expect(start == [.toolUseStart(ChatToolCallEvent(toolCallId: "call-1", name: "web_search"))])
        #expect(delta == [.toolUseDelta(
            ChatToolCallEvent(
                toolCallId: "call-1",
                parameters: .object(["query": .string("polychat")])
            )
        )])
        #expect(stop == [.toolUseStop("call-1")])
    }

    @Test func chatStreamParserReadsToolResponseResult() throws {
        let events = try ChatStreamEventParser.events(from: """
        {
            "type": "tool_response",
            "tool_id": "message-1",
            "result": {
                "role": "tool",
                "id": "message-1",
                "name": "web_search",
                "status": "success",
                "content": "Three results",
                "data": {
                    "humanInTheLoop": {
                        "type": "question",
                        "status": "pending",
                        "interactionId": "question-1"
                    },
                    "questions": [{"id": "tone", "prompt": "Which tone?", "options": [], "allowOther": true}]
                },
                "tool_call_id": "call-1",
                "log_id": "log-1",
                "timestamp": 1774000000
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
            parameters: .object(["query": .string("polychat")])
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
            from: #"{"type":"usage_limits","usage_limits":{"credits":{"included":500,"used":125,"reserved":25,"grace":50,"overrun":0,"overage":0,"overage_enabled":false,"state":"ok"}}}"#
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
        let run = makeChatRun(status: "awaiting_approval")
        let candidate = ConnectorApprovalCandidate.latest(
            in: [makeConnectorApprovalMessage()],
            run: run
        )

        #expect(candidate == ConnectorApprovalCandidate(
            approvalId: "coa_action",
            runId: "run-1",
            completionId: "conversation-1",
            provider: "gmail",
            operation: "GMAIL_SEND_EMAIL"
        ))

        let successor = ChatRun(
            protocolVersion: 1,
            id: "run-2",
            conversationId: "conversation-1",
            projectId: nil,
            projectTaskId: nil,
            initiatorUserId: 7,
            status: "awaiting_approval",
            attempt: 1,
            createdAt: "2026-09-05T12:05:00.000Z",
            updatedAt: "2026-09-05T12:05:00.000Z",
            startedAt: nil,
            completedAt: nil,
            terminalReason: nil,
            lastMessageId: nil
        )
        #expect(ConnectorApprovalCandidate.latest(
            in: [makeConnectorApprovalMessage()],
            run: successor
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
    type: String = "run.status_changed"
) -> ChatRunEvent {
    ChatRunEvent(
        protocolVersion: 1,
        id: "event-\(sequence)",
        runId: "run-1",
        sequence: sequence,
        attempt: 1,
        type: type,
        occurredAt: "2026-09-05T12:00:0\(sequence).000Z",
        data: ["status": .string(status)]
    )
}

extension UtilityTests {
    @Test func chatRunUsagePresentationDoesNotPresentUnknownConsumptionAsZero() throws {
        let run = try JSONDecoder().decode(ChatRun.self, from: Data("""
        {
            "protocolVersion": 1, "id": "run-1", "conversationId": "conversation-1",
            "projectId": null, "projectTaskId": null, "initiatorUserId": 7,
            "status": "running", "attempt": 1,
            "createdAt": "2026-09-05T10:00:00.000Z", "updatedAt": "2026-09-05T10:00:00.000Z",
            "startedAt": null, "completedAt": null, "terminalReason": null, "lastMessageId": null,
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

        #expect(ChatRunUsagePresentation.summary(usage) == "unknown usage · consumption unknown · released")
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
}
