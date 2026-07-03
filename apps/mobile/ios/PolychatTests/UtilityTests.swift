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
}
