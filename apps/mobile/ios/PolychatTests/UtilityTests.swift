import Foundation
import Testing
import UniformTypeIdentifiers
@testable import Polychat

struct UtilityTests {
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

    @Test func chatStreamParserReadsConversationTitle() throws {
        let events = try ChatStreamEventParser.events(
            from: #"{"type":"state","state":"conversation_title","title":"Durable Object concurrency"}"#
        )

        #expect(events == [.conversationTitle("Durable Object concurrency")])
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
                parameterFragment: #"{"query":"polychat"}"#
            )
        )])
        #expect(stop == [.toolUseStop("call-1")])
    }

    @Test func chatStreamParserTypesSemanticTurnActivityAndIgnoresUnknownKinds() throws {
        let started = try ChatStreamEventParser.events(
            from: #"{"type":"turn_activity","kind":"tool_execution_started","step":2,"toolCallId":"call-1","toolName":"web_search"}"#
        )
        let waiting = try ChatStreamEventParser.events(
            from: #"{"type":"turn_activity","kind":"waiting_for_user","step":2,"toolCallId":"call-2","toolName":"ask_user","reason":"question"}"#
        )
        let selection = try ChatStreamEventParser.events(
            from: #"{"type":"turn_activity","kind":"waiting_for_user","step":2,"toolCallId":"call-3","toolName":"select_council_members","reason":"selection"}"#
        )
        let unknown = try ChatStreamEventParser.events(
            from: #"{"type":"turn_activity","kind":"future_phase","step":2}"#
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
