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

    @Test func chatMessageDetectsVisibleCompactionStatusMessages() throws {
        let data = Data("""
        {
            "id": "snapshot-1-compaction",
            "completion_id": "conversation-1",
            "role": "compaction",
            "content": "",
            "parts": [
                {
                    "id": "compaction-part-1",
                    "type": "compaction",
                    "status": "completed",
                    "label": "Context automatically compacted",
                    "metadata": {
                        "source": "automatic-compaction"
                    }
                }
            ]
        }
        """.utf8)

        let message = try JSONDecoder().decode(ChatMessage.self, from: data)

        #expect(message.isCompactionMarker)
        #expect(message.isVisibleCompactionStatus)
        #expect(message.completionId == "conversation-1")
        #expect(message.compactionStatusLabel == "Context automatically compacted")
        let part = try #require(message.parts?.first)
        #expect(part.id == "compaction-part-1")
        #expect(part.metadata == .object(["source": .string("automatic-compaction")]))
    }

    @Test func chatMessageProviderMessagesExcludeCompactionMarkers() throws {
        let userMessage = ChatMessage(id: "user-1", role: "user", content: "Continue")
        let assistantMessage = ChatMessage(id: "assistant-1", role: "assistant", content: "Ready")
        let compactionMessage = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {
            "id": "snapshot-1-compaction",
            "role": "compaction",
            "content": "Context compacted",
            "parts": [
                {
                    "type": "compaction",
                    "status": "completed",
                    "label": "Context compacted"
                }
            ]
        }
        """.utf8))
        let assistantShapedCompactionMessage = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {
            "id": "assistant-shaped-compaction",
            "role": "assistant",
            "content": "Context compacted",
            "parts": [
                {
                    "type": "compaction",
                    "status": "completed",
                    "label": "Context compacted"
                }
            ]
        }
        """.utf8))

        let providerMessages = ChatMessage.providerMessages(from: [
            userMessage,
            compactionMessage,
            assistantShapedCompactionMessage,
            assistantMessage
        ])

        #expect(assistantShapedCompactionMessage.isCompactionMarker)
        #expect(assistantShapedCompactionMessage.isVisibleCompactionStatus == false)
        #expect(providerMessages.map(\.id) == ["user-1", "assistant-1"])
    }

    @Test func malformedAssistantShapedCompactionPartsAreNotDisplayMarkersButStayOutOfProviderRequests() throws {
        let userMessage = ChatMessage(id: "user-1", role: "user", content: "Continue")
        let assistantMessage = ChatMessage(id: "assistant-1", role: "assistant", content: "Ready")
        let malformedCompactionMessage = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {
            "id": "assistant-shaped-compaction",
            "role": "assistant",
            "content": "Context compacted",
            "parts": [
                {
                    "type": "compaction",
                    "status": "unknown",
                    "label": "Context compacted"
                }
            ]
        }
        """.utf8))

        #expect(malformedCompactionMessage.isCompactionMarker == false)
        #expect(malformedCompactionMessage.isVisibleCompactionStatus == false)
        #expect(ChatMessage.providerMessages(from: [
            userMessage,
            malformedCompactionMessage,
            assistantMessage
        ]).map(\.id) == ["user-1", "assistant-1"])
    }

    @Test func roleOnlyCompactionMessagesAreSafetyMarkersButNotDisplayMarkers() throws {
        let userMessage = ChatMessage(id: "user-1", role: "user", content: "Continue")
        let assistantMessage = ChatMessage(id: "assistant-1", role: "assistant", content: "Ready")
        let roleOnlyCompactionMessage = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {
            "id": "snapshot-1-compaction",
            "role": "compaction",
            "content": "Context compacted"
        }
        """.utf8))

        #expect(roleOnlyCompactionMessage.isCompactionMarker)
        #expect(roleOnlyCompactionMessage.isVisibleCompactionStatus == false)
        #expect(ChatMessage.providerMessages(from: [
            userMessage,
            roleOnlyCompactionMessage,
            assistantMessage
        ]).map(\.id) == ["user-1", "assistant-1"])
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

    @Test func recipeInstallResponseDecodesOptionalInstallationAndNullConfigurationValues() throws {
        let data = Data("""
        {
            "recipe": {
                "id": "daily-weather",
                "title": "Daily Weather",
                "summary": "Forecast",
                "description": "Forecast",
                "kind": "automate",
                "category": "Productivity",
                "featured": false,
                "estimatedSetupMinutes": 2,
                "integrations": [],
                "triggers": [],
                "actions": [],
                "setupPrompt": "Set up weather",
                "enabledTools": ["get_weather"],
                "configurationFields": [
                    {
                        "key": "location",
                        "label": "Location",
                        "type": "text",
                        "required": true,
                        "defaultValue": null
                    }
                ]
            },
            "conversationStarter": "Set up weather",
            "messageUrl": "/?query=Set%20up%20weather",
            "checklist": [],
            "connections": [],
            "readyToRun": true,
            "enabledTools": ["get_weather"]
        }
        """.utf8)
        let configurationData = Data(#"{"location":null}"#.utf8)

        let response = try JSONDecoder().decode(AssistantRecipeInstallResponse.self, from: data)
        let configuration = try JSONDecoder().decode(RecipeConfiguration.self, from: configurationData)

        #expect(response.installation == nil)
        #expect(configuration["location"] == .null)
        #expect(response.recipe.configurationFields.first?.defaultValue == nil)
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

    @Test func chatCompletionRequestExcludesCompactionMarkers() throws {
        let userMessage = ChatMessage(id: "user-1", role: "user", content: "Continue")
        let compactionMessage = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {
            "id": "snapshot-1-compaction",
            "role": "compaction",
            "content": "Context compacted",
            "parts": [
                {
                    "type": "compaction",
                    "status": "completed",
                    "label": "Context compacted"
                }
            ]
        }
        """.utf8))

        let request = ChatCompletionRequest(
            messages: [userMessage, compactionMessage],
            model: "deepseek-chat",
            provider: "deepseek",
            completionId: "conversation-1",
            settings: .default,
            stream: true
        )

        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let messages = try #require(json["messages"] as? [[String: Any]])

        #expect(messages.map { $0["id"] as? String } == ["user-1"])
        #expect(messages.map { $0["role"] as? String } == ["user"])
    }

    @Test func chatCompletionRequestSendsSnapshotMessagesAsTextWithoutInternalParts() throws {
        let snapshotMessage = ChatMessage(
            id: "snapshot-1",
            role: "assistant",
            content: "Conversation snapshot\n\nEarlier context summary.",
            parts: [
                ChatMessagePart(
                    type: "snapshot",
                    title: "Conversation snapshot",
                    summary: "Earlier context summary."
                ),
                ChatMessagePart(
                    type: "text",
                    text: "Conversation snapshot\n\nEarlier context summary."
                )
            ]
        )

        let request = ChatCompletionRequest(
            messages: [snapshotMessage],
            model: "deepseek-chat",
            provider: "deepseek",
            completionId: "conversation-1",
            settings: .default,
            stream: true
        )

        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let messages = try #require(json["messages"] as? [[String: Any]])
        let message = try #require(messages.first)

        #expect(message["role"] as? String == "assistant")
        #expect(message["content"] as? String == "Conversation snapshot\n\nEarlier context summary.")
        #expect(message["parts"] == nil)
    }

    @Test func titleGenerationRequestExcludesCompactionMarkers() throws {
        let userMessage = ChatMessage(id: "user-1", role: "user", content: "Continue")
        let compactionMessage = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {
            "id": "snapshot-1-compaction",
            "role": "compaction",
            "content": "Context compacted",
            "parts": [
                {
                    "type": "compaction",
                    "status": "completed",
                    "label": "Context compacted"
                }
            ]
        }
        """.utf8))

        let request = TitleGenerationRequest(messages: [compactionMessage, userMessage])

        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let messages = try #require(json["messages"] as? [[String: Any]])

        #expect(messages.map { $0["id"] as? String } == ["user-1"])
        #expect(messages.map { $0["role"] as? String } == ["user"])
    }

    @Test func updateConversationRequestPreservesCompactionMarkerMetadata() throws {
        let compactionMessage = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {
            "id": "snapshot-1-compaction",
            "completion_id": "conversation-1",
            "role": "compaction",
            "content": "Context compacted",
            "created": 1234,
            "parts": [
                {
                    "id": "compaction-part-1",
                    "type": "compaction",
                    "status": "completed",
                    "label": "Context compacted",
                    "metadata": {
                        "source": "manual-compaction"
                    }
                }
            ]
        }
        """.utf8))

        let request = UpdateConversationRequest(messages: [compactionMessage])

        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let messages = try #require(json["messages"] as? [[String: Any]])
        let message = try #require(messages.first)
        let parts = try #require(message["parts"] as? [[String: Any]])
        let part = try #require(parts.first)
        let metadata = try #require(part["metadata"] as? [String: Any])

        #expect(message["id"] as? String == "snapshot-1-compaction")
        #expect(message["completion_id"] as? String == "conversation-1")
        #expect(message["created"] as? Double == 1234)
        #expect(part["id"] as? String == "compaction-part-1")
        #expect(metadata["source"] as? String == "manual-compaction")
    }
}
