import Foundation
import Testing
import UIKit
@testable import Polychat

struct ModelTests {
    @Test func taskInboxDecodesReadStateAndCurrentDeepLink() throws {
        let inbox = try JSONDecoder().decode(TaskInboxResponse.self, from: Data("""
        {
            "items": [{
                "id": "task-1:v3",
                "kind": "approval",
                "taskId": "task-1",
                "projectId": "project-1",
                "workspaceId": "workspace-1",
                "projectName": "Launch",
                "objective": "Approve release",
                "detail": "Waiting for an approval",
                "conversationId": "conversation-1",
                "since": "2026-09-05T12:00:00.000Z",
                "requiresAction": true,
                "isRead": false,
                "readAt": null,
                "deepLink": "/work/workspace-1/projects/project-1/tasks/task-1"
            }],
            "total": 1,
            "unread": 1
        }
        """.utf8))

        #expect(inbox.unread == 1)
        #expect(inbox.items.first?.id == "task-1:v3")
        #expect(inbox.items.first?.requiresAction == true)
        #expect(inbox.items.first?.isRead == false)
    }

    @Test func notificationSettingsKeepPermissionSeparateFromServerRegistration() throws {
        let settings = try JSONDecoder().decode(TaskNotificationSettings.self, from: Data("""
        {
            "protocolVersion": 1,
            "preferences": {
                "enabled": true,
                "decisions": true,
                "failures": true,
                "completions": true,
                "assignments": false
            },
            "registrations": [{
                "id": "registration-1",
                "installationId": "installation-1",
                "platform": "ios",
                "state": "failed",
                "failureCode": "endpoint_expired",
                "updatedAt": "2026-09-05T12:00:00.000Z"
            }],
            "webPushPublicKey": null
        }
        """.utf8))

        #expect(settings.preferences.enabled == true)
        #expect(settings.registrations.first?.state == "failed")
        #expect(settings.registrations.first?.failureCode == "endpoint_expired")
    }

    @Test func modelReadinessDecodesUnknownAndExpiresAtTheBoundary() throws {
        let model = try JSONDecoder().decode(ModelConfigItem.self, from: Data("""
        {
            "name": "Unknown model",
            "provider": "test",
            "readiness": {
                "protocolVersion": 1,
                "state": "unknown",
                "reasonCode": "check_failed",
                "reason": "The provider check failed.",
                "checkedAt": "2026-09-05T10:00:00.000Z",
                "expiresAt": "2026-09-05T10:01:00.000Z",
                "action": { "kind": "retry", "label": "Refresh models" }
            }
        }
        """.utf8))

        #expect(model.readiness?.state == "unknown")
        #expect(model.readiness?.isFresh(at: try #require(AppDateParser.parse("2026-09-05T10:00:59.000Z"))) == true)
        #expect(model.readiness?.isFresh(at: try #require(AppDateParser.parse("2026-09-05T10:01:00.000Z"))) == false)
    }

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

    @Test func chatMessagePreservesItsRunIdentity() throws {
        let message = try JSONDecoder().decode(
            ChatMessage.self,
            from: Data(#"{"id":"assistant-1","role":"assistant","content":"Done","run_id":"run-1"}"#.utf8)
        )

        #expect(message.runId == "run-1")
    }

    @Test func chatRunDecodesVersionedContextWithoutFabricatingReportedUsage() throws {
        let data = Data("""
        {
            "protocolVersion": 1,
            "id": "run-1",
            "conversationId": "conversation-1",
            "projectId": "project-1",
            "projectTaskId": "task-1",
            "stageId": "build",
            "initiatorUserId": 1,
            "status": "running",
            "attempt": 1,
            "createdAt": "2026-09-05T10:00:00.000Z",
            "updatedAt": "2026-09-05T10:00:00.000Z",
            "startedAt": "2026-09-05T10:00:00.000Z",
            "completedAt": null,
            "terminalReason": null,
            "lastMessageId": null,
            "retry": {
                "protocolVersion": 1,
                "step": 2,
                "attempt": 2,
                "maxAttempts": 2,
                "runRetry": 1,
                "maxRunRetries": 2,
                "phase": "waiting",
                "classification": "rate_limited",
                "reason": "The model provider is rate limited.",
                "scheduledAt": "2026-09-05T09:59:59.000Z",
                "retryAt": "2026-09-05T10:00:01.000Z"
            },
            "context": {
                "protocolVersion": 1,
                "runId": "run-1",
                "conversationId": "conversation-1",
                "attempt": 1,
                "step": 2,
                "model": "model-1",
                "provider": "provider-1",
                "generatedAt": "2026-09-05T10:00:00.000Z",
                "usage": { "inputTokens": 4200, "contextWindow": 32000, "source": "estimated" },
                "messages": { "included": 8, "omitted": 1 },
                "sources": [],
                "skills": [],
                "approvals": [
                    {
                        "id": "approval-1",
                        "type": "approval",
                        "status": "approved",
                        "toolName": "publish",
                        "messageId": "message-2"
                    }
                ],
                "summary": {
                    "messageId": "snapshot-1",
                    "status": "included",
                    "text": "Keep the user's later constraint.",
                    "representedMessageCount": 8,
                    "candidateMessageCount": 9,
                    "fallback": false
                },
                "omissions": []
            }
        }
        """.utf8)

        let run = try JSONDecoder().decode(ChatRun.self, from: data)

        #expect(run.context?.usage.source == "estimated")
        #expect(run.stageId == "build")
        #expect(run.context?.messages.omitted == 1)
        #expect(run.context?.provider == "provider-1")
        #expect(run.context?.approvals?.first?.toolName == "publish")
        #expect(run.context?.summary?.status == "included")
        #expect(run.retry?.classification == "rate_limited")
    }

    @Test func cancellationRequestEncodesTheExactAttemptFence() throws {
        let request = CancelChatRunRequest(commandId: "cancel-1", expectedAttempt: 3)
        let object = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]
        )

        #expect(object["command_id"] as? String == "cancel-1")
        #expect(object["expected_attempt"] as? Int == 3)
    }

    @Test func chatMessagePreservesAndDescribesPartialCompactionCoverage() throws {
        let data = Data("""
        {
            "id": "snapshot-1-compaction",
            "role": "compaction",
            "content": "Context compacted",
            "parts": [
                {
                    "type": "compaction",
                    "status": "completed",
                    "coverage": {
                        "coveredMessageIds": ["message-1", "message-2"],
                        "coveredMessageCount": 2,
                        "candidateMessageCount": 3,
                        "summaryInputCharacters": 1200,
                        "strategy": "fallback_transcript"
                    }
                }
            ]
        }
        """.utf8)

        let message = try JSONDecoder().decode(ChatMessage.self, from: data)
        let coverage = try #require(message.parts?.first?.coverage)

        #expect(coverage.coveredMessageIds == ["message-1", "message-2"])
        #expect(coverage.summaryInputCharacters == 1200)
        #expect(message.compactionCoverageDetail == "2 messages preserved verbatim; 1 message retained")
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
        #expect(json["tool_selection_mode"] as? String == "managed")
        #expect(json["model_router_mode"] == nil)
        #expect((json["command_id"] as? String)?.isEmpty == false)
    }

    @Test func chatCompletionRequestPreservesCommandAndRunIdentity() throws {
        let request = ChatCompletionRequest(
            messages: [ChatMessage(role: "user", content: "Approved")],
            model: "gpt-6-astra",
            completionId: "conversation-1",
            commandId: "command-1",
            runId: "run-1"
        )

        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])

        #expect(json["command_id"] as? String == "command-1")
        #expect(json["run_id"] as? String == "run-1")
    }

    @Test func chatCompletionRequestUsesAutomaticRoutingWithoutAModel() throws {
        let request = ChatCompletionRequest(
            messages: [ChatMessage(role: "user", content: "Hi")],
            model: nil
        )

        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])

        #expect(json["model"] == nil)
        #expect(json["provider"] == nil)
        #expect(json["model_router_mode"] as? String == "auto")
    }

    @Test func chatCompletionRequestSendsSelectedProcessingTier() throws {
        let request = ChatCompletionRequest(
            messages: [ChatMessage(role: "user", content: "Hi")],
            model: "gpt-6-astra",
            settings: ChatSettings(serviceTier: .fast)
        )

        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])

        #expect(json["service_tier"] as? String == "fast")
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

extension ModelTests {
    @Test func chatRunUsageKeepsHoldsConsumptionAndUnknownValuesDistinct() throws {
        let run = try JSONDecoder().decode(ChatRun.self, from: Data("""
        {
            "protocolVersion": 1,
            "id": "run-1",
            "conversationId": "conversation-1",
            "projectId": null,
            "projectTaskId": null,
            "stageId": "build",
            "initiatorUserId": 7,
            "status": "running",
            "attempt": 2,
            "createdAt": "2026-09-05T10:00:00.000Z",
            "updatedAt": "2026-09-05T10:05:00.000Z",
            "startedAt": null,
            "completedAt": null,
            "cancellationRequestedAt": null,
            "terminalReason": null,
            "lastMessageId": null,
            "context": null,
            "retry": null,
            "usage": {
                "protocolVersion": 1,
                "runId": "run-1",
                "currentAttempt": 2,
                "measurement": "unknown",
                "reservation": {
                    "creditMicros": 50000,
                    "status": "held",
                    "expiresAt": "2026-09-06T10:00:00.000Z",
                    "createdAt": "2026-09-05T10:00:00.000Z",
                    "updatedAt": null
                },
                "consumption": {
                    "status": "unknown",
                    "eventCount": 0,
                    "costMicros": null,
                    "creditMicros": null,
                    "estimatedPriceEventCount": 0,
                    "bySource": []
                },
                "attempts": [],
                "settlement": { "status": "pending", "at": null }
            }
        }
        """.utf8))

        #expect(run.stageId == "build")
        #expect(run.usage?.reservation?.creditMicros == 50_000)
        #expect(run.usage?.consumption.creditMicros == nil)
        #expect(run.usage?.settlement.status == "pending")
    }
}

extension ModelTests {
    @Test func projectTaskPlanEvidenceKeepsProposalsSeparateFromAttempts() throws {
        let data = Data("""
        {
            "protocolVersion": 1,
            "id": "task-1",
            "status": "active",
            "stages": [
                {
                    "id": "task-1:build",
                    "flowStageId": "build",
                    "name": "Build",
                    "status": "failed",
                    "input": { "objective": "Ship", "acceptanceCriterionIds": [] },
                    "completionIds": [],
                    "outputs": [{ "id": "output-1", "title": "Draft", "kind": "report", "status": "ready" }],
                    "attempts": [{
                        "id": "run-1:1",
                        "runId": "run-1",
                        "conversationId": "conversation-1",
                        "attempt": 1,
                        "status": "failed",
                        "startedAt": "2026-09-05T10:00:00.000Z",
                        "completedAt": "2026-09-05T10:01:00.000Z",
                        "terminalReason": "Provider failed",
                        "completionIds": [],
                        "outputs": [{ "id": "output-1", "title": "Draft", "kind": "report", "status": "ready" }],
                        "provenance": {
                            "protocolVersion": 1,
                            "capturedAt": "2026-09-05T10:01:00.000Z",
                            "completeness": "partial",
                            "origin": "generated",
                            "run": { "id": "run-1", "attempt": 1 },
                            "model": null,
                            "skills": [],
                            "sources": [],
                            "approvals": []
                        }
                    }]
                },
                {
                    "id": "task-1:publish",
                    "flowStageId": "publish",
                    "name": "Publish",
                    "status": "proposed",
                    "input": { "objective": "Ship", "acceptanceCriterionIds": [] },
                    "attempts": [],
                    "completionIds": [],
                    "outputs": []
                }
            ],
            "resume": { "supported": false, "reason": "Reconcile the provider." }
        }
        """.utf8)

        let plan = try JSONDecoder().decode(ProjectTaskPlanEvidence.self, from: data)

        #expect(plan.stages[0].attempts[0].runId == "run-1")
        #expect(plan.stages[0].outputs[0].id == "output-1")
        #expect(plan.stages[1].status == "proposed")
        #expect(plan.resume.supported == false)
    }

    @Test func outputHistoryDecodesRevisionAndRestoreLineage() throws {
        let data = Data("""
        {
            "current": {
                "outputId": "output-1",
                "revision": 3,
                "parentRevision": 2,
                "title": "Restored draft",
                "status": "ready",
                "sensitivity": "personal",
                "content": { "body": "Earlier text" },
                "createdByUserId": 42,
                "createdAt": "2026-09-05T13:00:00.000Z",
                "operation": "restored",
                "restoredFromRevision": 1,
                "provenance": {
                    "protocolVersion": 1,
                    "capturedAt": "2026-09-05T12:00:00.000Z",
                    "completeness": "complete",
                    "origin": "generated",
                    "run": { "id": "run-1", "attempt": 2 },
                    "model": { "id": "model-1", "provider": "provider-1" },
                    "skills": [],
                    "sources": [],
                    "approvals": []
                }
            },
            "revisions": [],
            "restore": {
                "supported": true,
                "reason": null,
                "fields": ["title", "content"]
            }
        }
        """.utf8)

        let history = try JSONDecoder().decode(OutputHistoryResponse.self, from: data)

        #expect(history.current.parentRevision == 2)
        #expect(history.current.operation == "restored")
        #expect(history.current.restoredFromRevision == 1)
        #expect(history.current.provenance.model?.provider == "provider-1")
        #expect(history.restore.fields == ["title", "content"])
    }
}
