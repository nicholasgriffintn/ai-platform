import Foundation
import Testing
import UIKit
@testable import Polychat

struct ModelTests {
    @Test func messageContentDecodesTextAndMultimodalBlocks() throws {
        let text = try JSONDecoder().decode(MessageContent.self, from: Data(#""Hello""#.utf8))
        #expect(text.textValue == "Hello")

        let blocks = try JSONDecoder().decode(MessageContent.self, from: Data(#"[{"type":"text","text":"Hello"},{"type":"thinking","thinking":"Plan","signature":"sig"}]"#.utf8))
        #expect(blocks.textValue == "Hello")

        guard case .multimodal(let contentBlocks) = blocks else {
            Issue.record("Expected multimodal content")
            return
        }

        #expect(contentBlocks.textContent == "Hello\nPlan")
    }

    @Test func chatMessageExtractsInlineAndCodeArtifacts() throws {
        var message = ChatMessage(
            role: "assistant",
            content: """
            <artifact identifier="a1" type="text/html" language="html" title="Markup">
            <p>Hello</p>
            </artifact>

            ```swift
            let answer = 42
            ```
            """
        )

        message.extractArtifacts()

        let artifacts = try #require(message.artifacts)
        #expect(artifacts.count == 2)
        #expect(artifacts[0].id == "a1")
        #expect(artifacts[0].type == .code)
        #expect(artifacts[0].content.contains("<p>Hello</p>"))
        #expect(artifacts[1].type == .code)
        #expect(artifacts[1].title == "Swift Block")
        #expect(artifacts[1].content == "let answer = 42\n")
    }

    @Test func composerAttachmentProducesExpectedContentBlocks() {
        let image = ComposerAttachment(type: .image, url: "https://example.com/image.jpg", name: "image.jpg", markdown: nil, thumbnail: nil)
        let document = ComposerAttachment(type: .document, url: "https://example.com/file.pdf", name: "file.pdf", markdown: nil, thumbnail: nil)
        let audio = ComposerAttachment(type: .audio, url: "https://example.com/audio.mp3", name: "audio.mp3", markdown: nil, thumbnail: nil)
        let markdown = ComposerAttachment(type: .markdownDocument, url: "https://example.com/doc.md", name: "doc.md", markdown: "# Doc", thumbnail: nil)

        guard case .imageUrl(let imageBlock) = image.contentBlock() else {
            Issue.record("Expected image block")
            return
        }
        #expect(imageBlock.imageUrl.url == "https://example.com/image.jpg")

        guard case .documentUrl(let documentBlock) = document.contentBlock() else {
            Issue.record("Expected document block")
            return
        }
        #expect(documentBlock.documentUrl.name == "file.pdf")

        guard case .audioUrl(let audioBlock) = audio.contentBlock() else {
            Issue.record("Expected audio block")
            return
        }
        #expect(audioBlock.audioUrl.url == "https://example.com/audio.mp3")

        guard case .markdownDocument(let markdownBlock) = markdown.contentBlock() else {
            Issue.record("Expected markdown document block")
            return
        }
        #expect(markdownBlock.markdownDocument.markdown == "# Doc")
    }

    @Test func modelConfigDecodesAlternateFeaturedAndDeprecatedKeys() throws {
        let data = Data(#"{"provider":"openai","name":"Model","featured":true,"deprecated":true}"#.utf8)
        let model = try JSONDecoder().decode(ModelConfigItem.self, from: data)

        #expect(model.isFeatured == true)
        #expect(model.isDeprecated == true)
    }

    @Test func chatCompletionRequestSerializesMessagesForAPI() throws {
        let message = ChatMessage(
            id: "user-1",
            role: "user",
            contentBlocks: [
                .text(MessageContentBlock.TextBlock(text: "Hi")),
                .audioUrl(MessageContentBlock.AudioUrlBlock(url: "https://example.com/audio.mp3")),
                .imageUrl(MessageContentBlock.ImageUrlBlock(url: "https://example.com/image.png"))
            ]
        )

        let request = ChatCompletionRequest(
            messages: [message],
            model: "deepseek-chat",
            provider: "deepseek",
            completionId: "conversation-1",
            settings: .default,
            stream: true
        )

        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let messages = try #require(json["messages"] as? [[String: Any]])
        let firstMessage = try #require(messages.first)
        let content = try #require(firstMessage["content"] as? [[String: Any]])

        #expect(firstMessage["id"] as? String == "user-1")
        #expect(firstMessage["role"] as? String == "user")
        #expect(content.compactMap { $0["type"] as? String } == ["text", "image_url"])
        #expect(json["completion_id"] as? String == "conversation-1")
        #expect(json["stream"] as? Bool == true)
        #expect(json["platform"] as? String == "mobile")
        #expect(json["use_rag"] == nil)
        #expect(json["rag_options"] == nil)
        #expect(json["enabled_tools"] == nil)
    }
}
