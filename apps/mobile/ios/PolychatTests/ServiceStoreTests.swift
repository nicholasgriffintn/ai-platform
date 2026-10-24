import Foundation
import Testing
@testable import Polychat

struct ServiceStoreTests {
    @MainActor
    @Test func modelsStoreFetchesModelsSelectsServerDefaultAndPersistsSelection() async throws {
        let defaults = try makeIsolatedUserDefaults()
        let client = ModelsAPIClientStub(result: .success([
            "gpt-4o": makeModel(id: "", name: "GPT-4o", provider: "openai"),
            "mistral-small": makeModel(
                id: "",
                name: "Mistral Small",
                provider: "mistral",
                isDefault: true,
                runsOn: "server",
                isPlatformEnabled: true,
                isFree: true,
                isByokEnabled: false
            )
        ]))
        let store = ModelsStore(apiClient: client, userDefaults: defaults)

        await store.fetchModels()

        #expect(store.error == nil)
        #expect(store.models.map(\.id).sorted() == ["gpt-4o", "mistral-small"])
        #expect(store.models.first(where: { $0.id == "mistral-small" })?.runsOn == "server")
        #expect(store.models.first(where: { $0.id == "mistral-small" })?.isPlatformEnabled == true)
        #expect(store.models.first(where: { $0.id == "mistral-small" })?.isFree == true)
        #expect(store.models.first(where: { $0.id == "mistral-small" })?.isByokEnabled == false)
        #expect(store.selectedModelId == "mistral-small")
        #expect(defaults.string(forKey: "selectedModelId") == "mistral-small")

        store.selectModel("gpt-4o")
        #expect(defaults.string(forKey: "selectedModelId") == "gpt-4o")
    }

    @MainActor
    @Test func modelsStorePreservesPersistedDeprecatedSelectionWithAnIssue() async throws {
        let defaults = try makeIsolatedUserDefaults()
        defaults.set("retired-model", forKey: "selectedModelId")
        let client = ModelsAPIClientStub(result: .success([
            "retired-model": makeModel(id: "", deprecated: true),
            "active-model": makeModel(id: "", isDefault: true)
        ]))
        let store = ModelsStore(apiClient: client, userDefaults: defaults)

        await store.fetchModels()

        #expect(store.selectedModelId == "retired-model")
        #expect(defaults.string(forKey: "selectedModelId") == "retired-model")
        #expect(store.selectionIssue != nil)
    }

    @MainActor
    @Test func modelsStorePreservesPersistedInaccessibleSelectionWithAnIssue() async throws {
        let defaults = try makeIsolatedUserDefaults()
        defaults.set("pro-model", forKey: "selectedModelId")
        let client = ModelsAPIClientStub(result: .success([
            "pro-model": makeModel(id: "", isExecutable: false),
            "free-model": makeModel(id: "", isDefault: true, isExecutable: true)
        ]))
        let store = ModelsStore(apiClient: client, userDefaults: defaults)

        await store.fetchModels()

        #expect(store.selectedModelId == "pro-model")
        #expect(defaults.string(forKey: "selectedModelId") == "pro-model")
        #expect(store.selectionIssue != nil)
    }

    @MainActor
    @Test func modelsStorePreservesMissingSelectionWhenTheCatalogueHasNoDefault() async throws {
        let defaults = try makeIsolatedUserDefaults()
        defaults.set("retired-model", forKey: "selectedModelId")
        let client = ModelsAPIClientStub(result: .success([
            "active-model": makeModel(id: "", isExecutable: true)
        ]))
        let store = ModelsStore(apiClient: client, userDefaults: defaults)

        await store.fetchModels()

        #expect(store.selectedModelId == "retired-model")
        #expect(defaults.string(forKey: "selectedModelId") == "retired-model")
        #expect(store.selectionIssue?.contains("no longer available") == true)
    }

    @MainActor
    @Test func modelsStoreReportsFetchFailureWithoutClearingExistingModels() async throws {
        let defaults = try makeIsolatedUserDefaults()
        let store = ModelsStore(apiClient: ModelsAPIClientStub(result: .failure(TestFailure.forced)), userDefaults: defaults)
        store.models = [makeModel(id: "existing")]

        await store.fetchModels()

        #expect(store.models.map(\.id) == ["existing"])
        #expect(store.error?.contains("Failed to fetch models") == true)
        #expect(!store.isLoading)
    }

    @MainActor
    @Test func modelsStoreUsesTheRequestedModelForReadinessMessages() async throws {
        let defaults = try makeIsolatedUserDefaults()
        let store = ModelsStore(
            apiClient: ModelsAPIClientStub(result: .success([
                "blocked-model": makeModel(
                    id: "",
                    readiness: ModelReadiness(
                        protocolVersion: 1,
                        state: "blocked",
                        reasonCode: "provider_unavailable",
                        reason: "Provider unavailable",
                        checkedAt: "2026-09-16T10:00:00.000Z",
                        expiresAt: "2099-09-16T10:01:00.000Z"
                    )
                ),
                "ready-model": makeModel(
                    id: "",
                    readiness: ModelReadiness(
                        protocolVersion: 1,
                        state: "ready",
                        reasonCode: "ready",
                        reason: "Ready",
                        checkedAt: "2026-09-16T10:00:00.000Z",
                        expiresAt: "2099-09-16T10:01:00.000Z"
                    )
                )
            ])),
            userDefaults: defaults
        )

        await store.fetchModels()
        store.selectModel("blocked-model")

        #expect(store.readinessMessage(for: "ready-model") == nil)
        #expect(store.readinessMessage(for: "blocked-model") == "Provider unavailable")
    }

    @MainActor
    @Test func modelsStoreRefreshesExpiredReadinessBeforeSending() async throws {
        let defaults = try makeIsolatedUserDefaults()
        let expiredReadiness = ModelReadiness(
            protocolVersion: 1,
            state: "ready",
            reasonCode: "ready",
            reason: "Ready",
            checkedAt: "2020-09-16T10:00:00.000Z",
            expiresAt: "2020-09-16T10:01:00.000Z"
        )
        let freshReadiness = ModelReadiness(
            protocolVersion: 1,
            state: "ready",
            reasonCode: "ready",
            reason: "Ready",
            checkedAt: "2099-09-16T10:00:00.000Z",
            expiresAt: "2099-09-16T10:01:00.000Z"
        )
        let client = ModelsAPIClientStub(result: .success([
            "model": makeModel(id: "", readiness: freshReadiness)
        ]))
        let store = ModelsStore(apiClient: client, userDefaults: defaults)
        store.models = [makeModel(id: "model", readiness: expiredReadiness)]

        await store.refreshModelsIfNeeded(for: "model")

        #expect(store.model(withId: "model")?.readiness == freshReadiness)
    }

    @MainActor
    @Test func modelsStoreIgnoresAnOlderCatalogueResponse() async throws {
        let defaults = try makeIsolatedUserDefaults()
        let client = ModelsAPIClientStub(result: .success([:]))
        let oldModel = makeModel(id: "", name: "Old model")
        let newModel = makeModel(id: "", name: "New model")
        var fetchCount = 0
        client.fetchModelsHandler = {
            fetchCount += 1
            if fetchCount == 1 {
                try await Task.sleep(nanoseconds: 100_000_000)
                return ["model": oldModel]
            }

            return ["model": newModel]
        }
        let store = ModelsStore(apiClient: client, userDefaults: defaults)

        let firstFetch = Task { @MainActor in
            await store.fetchModels()
        }
        try await Task.sleep(nanoseconds: 10_000_000)
        let secondFetch = Task { @MainActor in
            await store.fetchModels()
        }

        await secondFetch.value
        await firstFetch.value

        #expect(store.model(withId: "model")?.name == "New model")
    }

    @MainActor
    @Test func aConversationPendingItsFirstSyncIsNotTemporary() {
        let conversation = makeConversation(id: "pending")

        #expect(conversation.isTemporary == false)
    }

    @MainActor
    @Test func conversationManagerStreamsAssistantMessageAndGeneratesTitle() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [
            .content("Hello"),
            .content(" there"),
            .metadata(ChatStreamMetadata(
                messageId: "server-message",
                content: "Hello there",
                model: "gpt-4o",
                parts: nil,
                reasoning: ChatReasoning(collapsed: true, content: "Reasoned"),
                citations: [ChatCitation(url: "https://example.com", title: "Example")],
                data: nil,
                name: nil,
                status: "complete",
                logId: "log-1",
                created: 1_774_000_000
            )),
            .messageStop,
            .done
        ]

        let defaults = try makeIsolatedUserDefaults()
        let modelsStore = ModelsStore(apiClient: ModelsAPIClientStub(result: .success([:])), userDefaults: defaults)
        modelsStore.models = [makeModel(id: "gpt-4o", provider: "openai")]
        modelsStore.selectModel("gpt-4o")

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient, modelsStore: modelsStore)
        let conversation = manager.startNewConversation()

        try await manager.addMessage(ChatMessage(role: "user", content: "Hi"))

        #expect(apiClient.streamedConversationId == conversation.id)
        #expect(apiClient.streamedModelId == "gpt-4o")
        #expect(apiClient.streamedMessages.map(\.role) == ["user"])
        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "assistant"])
        #expect(manager.currentConversation?.messages.last?.id == "server-message")
        #expect(manager.currentConversation?.messages.last?.textContent == "Hello there")
        #expect(manager.currentConversation?.messages.last?.model == "gpt-4o")
        #expect(manager.currentConversation?.messages.last?.reasoning?.content == "Reasoned")
        #expect(manager.currentConversation?.messages.last?.citations?.first?.url == "https://example.com")
        #expect(manager.currentConversation?.messages.last?.status == "complete")
        #expect(manager.currentConversation?.messages.last?.logId == "log-1")
        #expect(manager.currentConversation?.messages.last?.created == 1_774_000_000)
        #expect(manager.currentConversation?.title == "Generated title")
    }

    @MainActor
    @Test func conversationManagerSendsApprovalsTogetherOnceEveryOneIsDecided() async throws {
        func pendingApproval(_ callId: String) throws -> ChatMessage {
            try JSONDecoder().decode(ChatMessage.self, from: Data("""
            {
                "id": "tool-\(callId)",
                "role": "tool",
                "content": "Send the email?",
                "status": "pending",
                "run_id": "run-1",
                "name": "send_email",
                "data": {
                    "renderer": "approval_request",
                    "approvalRequired": true,
                    "options": ["Approve", "Reject"],
                    "approval": { "interactionId": "\(callId)", "toolName": "send_email" }
                }
            }
            """.utf8))
        }

        let apiClient = ConversationAPIClientStub()
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = manager.startNewConversation()
        conversation.messages = [
            ChatMessage(role: "user", content: "Email both"),
            try pendingApproval("call-1"),
            try pendingApproval("call-2")
        ]
        manager.currentConversation = conversation

        let requests = manager.pendingApprovals
        #expect(requests.map(\.interactionId) == ["call-1", "call-2"])

        await manager.decideApproval(requests[0], option: "Approve")
        #expect(apiClient.submittedApprovalBatches.isEmpty)

        await manager.decideApproval(requests[1], option: "Reject")
        #expect(apiClient.submittedApprovalBatches.count == 1)
        #expect(apiClient.submittedApprovalBatches.first?.responseId == "run-1")
        #expect(apiClient.submittedApprovalBatches.first?.decisions.map(\.resolution) == ["approved", "rejected"])
        #expect(manager.approvalDecisions.isEmpty)
    }

    @MainActor
    @Test func conversationManagerPrependsAnAuthorisedEarlierMessagePageWithoutDuplicates() async {
        let apiClient = ConversationAPIClientStub()
        apiClient.conversationMessagePage = ConversationMessagePageResponse(
            messages: [
                ChatMessage(id: "message-1", role: "user", content: "Earlier"),
                ChatMessage(id: "message-2", role: "assistant", content: "Already loaded")
            ],
            hasMore: false,
            oldestMessageId: "message-1"
        )
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(
            id: "conversation-1",
            messages: [ChatMessage(id: "message-2", role: "assistant", content: "Already loaded")]
        )
        conversation.hasMoreMessages = true
        conversation.oldestMessageId = "message-2"
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.loadEarlierMessages()

        #expect(manager.currentConversation?.messages.map(\.id) == ["message-1", "message-2"])
        #expect(manager.currentConversation?.hasMoreMessages == false)
        #expect(manager.currentConversation?.oldestMessageId == "message-1")
    }

    @MainActor
    @Test func conversationManagerDoesNotSubstituteAStaleConversationModelBeforeStreaming() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [.content("Hello"), .done]
        let defaults = try makeIsolatedUserDefaults()
        let modelsStore = ModelsStore(
            apiClient: ModelsAPIClientStub(result: .success([:])),
            userDefaults: defaults
        )
        modelsStore.models = [
            makeModel(id: "compound", provider: "groq", deprecated: true, isExecutable: false),
            makeModel(id: "active-model", provider: "workers-ai", isDefault: true, isExecutable: true)
        ]
        modelsStore.selectModel("active-model")

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient, modelsStore: modelsStore)
        var conversation = manager.startNewConversation()
        conversation.modelId = "compound"
        manager.currentConversation = conversation
        manager.conversations = [conversation]

        try await manager.addMessage(ChatMessage(role: "user", content: "Hi"))

        #expect(apiClient.streamCallCount == 0)
        #expect(manager.currentConversation?.messages.last?.textContent.contains("compound is no longer available") == true)
    }

    @MainActor
    @Test func conversationManagerInsertsStreamedCompactionMarkerBeforeAssistantReply() async throws {
        let compactionMessage = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {
            "id": "snapshot-1-compaction",
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
        """.utf8))
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [
            .compaction(compactionMessage),
            .content("After compaction"),
            .done
        ]

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        _ = manager.startNewConversation()

        try await manager.addMessage(ChatMessage(role: "user", content: "Continue"))

        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "compaction", "assistant"])
        #expect(manager.currentConversation?.messages[1].id == "snapshot-1-compaction")
        #expect(manager.currentConversation?.messages[1].compactionStatusLabel == "Context automatically compacted")
        #expect(manager.currentConversation?.messages.last?.textContent == "After compaction")
    }

    @MainActor
    @Test func conversationManagerKeepsTheAuthoritativeResponseFromTheStream() async throws {
        let response = PlatformResponse(
            id: "run-1",
            conversationId: "conversation-1",
            status: "in_progress",
            attempt: 1,
            initiatorUserId: 7,
            createdAt: "2026-09-05T12:00:00.000Z",
            updatedAt: "2026-09-05T12:00:00.000Z",
            startedAt: "2026-09-05T12:00:00.000Z",
            receipt: ResponseReceipt(
                idempotencyKey: "command-1",
                kind: "turn",
                acceptedAt: "2026-09-05T12:00:00.000Z",
                duplicate: false
            )
        )
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [
            .response(response),
            .content("Working"),
            .done
        ]

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = manager.startNewConversation()
        conversation = Conversation(
            id: "conversation-1",
            title: conversation.title,
            messages: conversation.messages,
            createdAt: conversation.createdAt,
            modelId: conversation.modelId,
            isLoadedFromAPI: conversation.isLoadedFromAPI,
            lastMessageAt: conversation.lastMessageAt,
            messageCount: conversation.messageCount
        )
        manager.currentConversation = conversation
        manager.conversations = [conversation]

        try await manager.addMessage(ChatMessage(role: "user", content: "Continue"))

        #expect(manager.currentConversation?.latestResponse?.id == "run-1")
        #expect(manager.conversations.first?.latestResponse?.status == "in_progress")
    }

    @MainActor
    @Test func conversationManagerCompletesBareCompactionStateBeforeAssistantReply() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [
            .state("compaction"),
            .content("After compaction"),
            .done
        ]

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        _ = manager.startNewConversation()

        try await manager.addMessage(ChatMessage(role: "user", content: "Continue"))

        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "compaction", "assistant"])
        #expect(manager.currentConversation?.messages[1].isCompactionMarker == true)
        #expect(manager.currentConversation?.messages[1].compactionStatusLabel == "Context automatically compacted")
        #expect(manager.currentConversation?.messages.last?.textContent == "After compaction")
    }

    @MainActor
    @Test func conversationManagerRemovesPendingCompactionStateWhenStreamFails() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [.state("compaction")]
        apiClient.streamError = TestFailure.forced

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        _ = manager.startNewConversation()

        try await manager.addMessage(ChatMessage(role: "user", content: "Continue"))

        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "assistant"])
        #expect(manager.currentConversation?.messages.contains { $0.isCompactionMarker } == false)
        #expect(manager.currentConversation?.messages.last?.textContent.hasPrefix("Error:") == true)
    }

    @MainActor
    @Test func conversationManagerShowsToolResultsBeforeAssistantReply() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [
            .toolUseStart(ChatToolCallEvent(toolCallId: "call-1", name: "web_search")),
            .toolUseDelta(ChatToolCallEvent(
                toolCallId: "call-1",
                parameters: .object(["query": .string("polychat")])
            )),
            .toolUseStop("call-1"),
            .toolResult(ChatToolResultEvent(
                id: "tool-message-1",
                toolCallId: "call-1",
                name: "web_search",
                status: "success",
                content: .string("Three results"),
                data: nil,
                logId: "log-1",
                model: nil,
                timestamp: 1_774_000_000
            )),
            .usageLimits(ChatUsageLimits(
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
            )),
            .content("Found three results"),
            .done
        ]

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        _ = manager.startNewConversation()

        try await manager.addMessage(ChatMessage(id: "user-1", role: "user", content: "Search please"))

        let messages = try #require(manager.currentConversation?.messages)
        #expect(messages.map(\.role) == ["user", "tool", "assistant"])
        #expect(messages[1].id == "tool-message-1")
        #expect(messages[1].parts?.map(\.type) == ["tool_result"])
        #expect(messages[1].parts?.first?.name == "web_search")
        #expect(messages[1].parts?.first?.content == .string("Three results"))
        #expect(messages.last?.textContent == "Found three results")
        #expect(manager.usageLimits?.credits?.used == 125)
    }

    @MainActor
    @Test func conversationManagerAcceptsStopBeforeReportingCancellationComplete() async throws {
        let apiClient = ConversationAPIClientStub()
        let running = makeResponse(status: "in_progress", attempt: 2)
        let cancelling = makeResponse(status: "cancelling", attempt: 2)
        apiClient.cancelledResponse = cancelling

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(id: "conversation-1")
        conversation.latestResponse = running
        manager.currentConversation = conversation
        manager.conversations = [conversation]

        await manager.cancelCurrentRun()

        #expect(apiClient.cancelledResponses.first?.id == "run-1")
        #expect(apiClient.cancelledResponses.first?.expectedAttempt == 2)
        #expect(manager.currentConversation?.latestResponse?.status == "cancelling")
    }

    @MainActor
    @Test func conversationManagerObservesAStopRequestedOnAnotherDevice() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.responseSnapshot = ResponseSnapshot(
            cursor: 4,
            response: makeResponse(status: "cancelled", attempt: 2),
            messages: [
                ChatMessage(id: "user-1", role: "user", content: "Search please"),
                ChatMessage(id: "assistant-1", role: "assistant", content: "Partial result")
            ]
        )

        let manager = ConversationManager()
        manager.configure(
            apiClient: apiClient,
            responseReplayPolicy: makeInstantResponseReplayPolicy()
        )
        var conversation = makeConversation(
            id: "conversation-1",
            messages: [ChatMessage(id: "user-1", role: "user", content: "Search please")]
        )
        conversation.latestResponse = makeResponse(status: "in_progress", attempt: 2)
        manager.currentConversation = conversation
        manager.conversations = [conversation]

        await manager.observeCurrentRun()

        #expect(apiClient.fetchResponseSnapshotCallCount == 1)
        #expect(manager.currentConversation?.latestResponse?.status == "cancelled")
        #expect(manager.currentConversation?.messages.last?.textContent == "Partial result")
    }

    @MainActor
    @Test func conversationManagerReplaysAnOutOfOrderCrossDeviceCancellationOnce() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.responseSnapshot = ResponseSnapshot(
            cursor: 2,
            response: makeResponse(status: "in_progress", attempt: 2),
            messages: [ChatMessage(id: "user-1", role: "user", content: "Search please")]
        )
        apiClient.responseReplay = ResponseReplayResponse(
            responseId: "run-1",
            fromCursor: 2,
            nextCursor: 4,
            resetRequired: false,
            events: [
                ResponseEventRecord(
                    id: "event-4",
                    responseId: "run-1",
                    sequence: 4,
                    attempt: 2,
                    type: "response.status_changed",
                    occurredAt: "2026-09-05T12:00:04.000Z",
                    data: ["status": .string("cancelled")]
                ),
                ResponseEventRecord(
                    id: "event-3",
                    responseId: "run-1",
                    sequence: 3,
                    attempt: 2,
                    type: "response.status_changed",
                    occurredAt: "2026-09-05T12:00:03.000Z",
                    data: ["status": .string("cancelling")]
                )
            ],
            snapshot: nil
        )

        let manager = ConversationManager()
        manager.configure(
            apiClient: apiClient,
            responseReplayPolicy: makeInstantResponseReplayPolicy()
        )
        var conversation = makeConversation(id: "conversation-1")
        conversation.latestResponse = makeResponse(status: "in_progress", attempt: 2)
        manager.currentConversation = conversation
        manager.conversations = [conversation]

        await manager.observeCurrentRun()

        #expect(apiClient.fetchResponseSnapshotCallCount == 2)
        #expect(apiClient.fetchResponseEventsCallCount == 1)
        #expect(manager.currentConversation?.latestResponse?.status == "cancelled")
    }

    @MainActor
    @Test func conversationManagerSurfacesStreamErrors() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamError = APIClientError.httpStatus(500, "Model unavailable")

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        _ = manager.startNewConversation()

        try await manager.addMessage(ChatMessage(role: "user", content: "Hi"))

        #expect(apiClient.fetchConversationCallCount == 0)
        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "assistant"])
        #expect(manager.currentConversation?.messages.last?.textContent == "Error: API returned 500: Model unavailable")
    }

    @MainActor
    @Test func conversationManagerReplacesLoadingMessageWhenAPIClientIsMissing() async throws {
        let manager = ConversationManager()
        _ = manager.startNewConversation()

        try await manager.addMessage(ChatMessage(role: "user", content: "Hi"))

        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "assistant"])
        #expect(manager.currentConversation?.messages.last?.textContent.contains("API client not configured") == true)
        #expect(manager.currentConversation?.messages.last?.textContent.hasPrefix("Error:") == true)
        #expect(manager.currentConversation?.isLoadedFromAPI == false)
    }

    @MainActor
    @Test func conversationManagerRegeneratesAssistantMessageFromPriorContext() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [
            .content("Updated answer"),
            .done
        ]

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        let conversation = manager.startNewConversation()
        manager.currentConversation?.messages = [
            ChatMessage(id: "user-1", role: "user", content: "Question"),
            ChatMessage(id: "assistant-1", role: "assistant", content: "Old answer"),
            ChatMessage(id: "user-2", role: "user", content: "Follow up")
        ]
        if let currentConversation = manager.currentConversation {
            manager.conversations = [currentConversation]
        }

        await manager.regenerateAssistantMessage("assistant-1")

        #expect(apiClient.streamCallCount == 1)
        #expect(apiClient.streamedConversationId == conversation.id)
        #expect(apiClient.streamedMessages.map(\.id) == ["user-1"])
        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "assistant"])
        #expect(manager.currentConversation?.messages.last?.textContent == "Updated answer")
        #expect(manager.currentConversation?.title == "New Conversation")
    }

    @MainActor
    @Test func conversationManagerRejectsAssistantShapedCompactionRetry() async throws {
        let apiClient = ConversationAPIClientStub()
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        let conversation = manager.startNewConversation()
        manager.currentConversation?.messages = [
            ChatMessage(id: "user-1", role: "user", content: "Question"),
            ChatMessage(
                id: "compaction-1",
                role: "assistant",
                content: "Context compacted",
                parts: [
                    ChatMessagePart(
                        type: "compaction",
                        label: "Context compacted",
                        status: "completed"
                    )
                ]
            )
        ]
        if let currentConversation = manager.currentConversation {
            manager.conversations = [currentConversation]
        }

        await manager.regenerateAssistantMessage("compaction-1")

        #expect(apiClient.streamCallCount == 0)
        #expect(apiClient.streamedMessages.isEmpty)
        #expect(manager.currentConversation?.id == conversation.id)
        #expect(manager.currentConversation?.messages.map(\.id) == ["user-1", "compaction-1"])
        #expect(manager.error == "Only user and assistant messages can be retried")
    }

    @MainActor
    @Test func conversationManagerEditsUserMessageAndRegeneratesFromThatPoint() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [
            .content("Edited answer"),
            .done
        ]

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        let conversation = manager.startNewConversation()
        manager.currentConversation?.messages = [
            ChatMessage(id: "user-1", role: "user", content: "Original question"),
            ChatMessage(id: "assistant-1", role: "assistant", content: "Old answer"),
            ChatMessage(id: "user-2", role: "user", content: "Follow up")
        ]
        if let currentConversation = manager.currentConversation {
            manager.conversations = [currentConversation]
        }

        await manager.editUserMessage("user-1", text: "  Edited question  ")

        #expect(apiClient.streamCallCount == 1)
        #expect(apiClient.streamedConversationId == conversation.id)
        #expect(apiClient.streamedMessages.map(\.id) == ["user-1"])
        #expect(apiClient.streamedMessages.first?.textContent == "Edited question")
        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "assistant"])
        #expect(manager.currentConversation?.messages.first?.textContent == "Edited question")
        #expect(manager.currentConversation?.messages.last?.textContent == "Edited answer")
    }

    @MainActor
    @Test func conversationManagerRejectsUserShapedCompactionEdit() async throws {
        let apiClient = ConversationAPIClientStub()
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        _ = manager.startNewConversation()
        manager.currentConversation?.messages = [
            ChatMessage(
                id: "compaction-1",
                role: "user",
                content: "Context compacted",
                parts: [
                    ChatMessagePart(
                        type: "compaction",
                        label: "Context compacted",
                        status: "completed"
                    )
                ]
            )
        ]
        if let currentConversation = manager.currentConversation {
            manager.conversations = [currentConversation]
        }

        await manager.editUserMessage("compaction-1", text: "Edited")

        #expect(apiClient.streamCallCount == 0)
        #expect(apiClient.streamedMessages.isEmpty)
        #expect(manager.currentConversation?.messages.first?.textContent == "Context compacted")
        #expect(manager.error == "Only user messages can be edited")
    }

    @MainActor
    @Test func conversationManagerEditingMultimodalUserMessagePreservesAttachments() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.streamEvents = [
            .content("Looked at the image"),
            .done
        ]

        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        let conversation = manager.startNewConversation()
        let imageBlock = MessageContentBlock.imageUrl(.init(url: "https://example.com/image.png"))
        manager.currentConversation?.messages = [
            ChatMessage(
                id: "user-1",
                role: "user",
                contentBlocks: [
                    .text(.init(text: "Original caption")),
                    imageBlock
                ]
            ),
            ChatMessage(id: "assistant-1", role: "assistant", content: "Old image answer")
        ]
        if let currentConversation = manager.currentConversation {
            manager.conversations = [currentConversation]
        }

        await manager.editUserMessage("user-1", text: "Updated caption")

        #expect(apiClient.streamedConversationId == conversation.id)
        #expect(apiClient.streamedMessages.first?.textContent == "Updated caption")
        guard case .multimodal(let streamedBlocks)? = apiClient.streamedMessages.first?.content else {
            Issue.record("Expected multimodal content to be preserved")
            return
        }
        #expect(streamedBlocks.contains(imageBlock))
        #expect(manager.currentConversation?.messages.first?.textContent == "Updated caption")
    }


    @MainActor
    @Test func conversationManagerPersistsRenamedLoadedConversation() async throws {
        let apiClient = ConversationAPIClientStub()
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        let conversation = makeConversation(id: "conversation-1", title: "Old", isLoadedFromAPI: true)
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.updateConversationTitle("conversation-1", title: "Renamed")

        #expect(manager.currentConversation?.title == "Renamed")
        #expect(manager.conversations.first?.title == "Renamed")
        #expect(apiClient.updatedConversationTitles.first?.id == "conversation-1")
        #expect(apiClient.updatedConversationTitles.first?.title == "Renamed")
    }

    @MainActor
    @Test func conversationManagerAnswersStructuredTaskQuestionsAfterServerAcknowledgement() async throws {
        let apiClient = ConversationAPIClientStub()
        let pending = makeProjectTaskDetail(interaction: makeProjectTaskInteraction())
        let resolvedTask = makeProjectTaskControlTask(status: "queued", blockedReason: nil)
        let resolved = makeProjectTaskDetail(
            task: resolvedTask,
            interaction: makeProjectTaskInteraction(status: "resolved")
        )
        apiClient.projectTaskDetails = [pending, resolved]
        apiClient.projectTaskResponse = ProjectTaskResponse(task: resolvedTask)
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(id: "conversation-1")
        conversation.latestResponse = makeResponse(
            status: "awaiting_input",
            projectId: "project-1",
            projectTaskId: "task-1"
        )
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.refreshCurrentTaskInteraction()
        await manager.answerCurrentTaskQuestions([
            UserQuestionAnswer(questionId: "tone", answer: "Friendly")
        ])

        #expect(apiClient.answeredProjectTaskQuestions.count == 1)
        #expect(apiClient.answeredProjectTaskQuestions.first?.interactionId == "question-1")
        #expect(apiClient.answeredProjectTaskQuestions.first?.answers.first?.answer == "Friendly")
        #expect(manager.currentTaskInteraction?.interaction.status == "resolved")
        #expect(manager.currentTaskInteraction?.submission == .acknowledged)
    }

    @MainActor
    @Test func conversationManagerRestoresAuthoritativeTaskActivityForTheExactProjectTask() async throws {
        let apiClient = ConversationAPIClientStub()
        let activity = makeProjectTaskActivity(items: [
            makeProjectTaskActivityItem(
                id: "failed-tool",
                type: "tool.completed",
                category: "tool",
                status: "failed",
                title: "Tool failed",
                detail: "fetch sources",
                actionable: false,
                terminal: true
            ),
            makeProjectTaskActivityItem()
        ])
        apiClient.projectTaskDetails = [
            makeProjectTaskDetail(interaction: makeProjectTaskInteraction(), activity: activity)
        ]
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(id: "conversation-1")
        conversation.latestResponse = makeResponse(
            status: "awaiting_input",
            projectId: "project-1",
            projectTaskId: "task-1"
        )
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.refreshCurrentTaskInteraction()

        #expect(manager.currentTaskActivity == activity)
        #expect(manager.currentTaskActivity?.items.first?.status == "failed")
        #expect(manager.currentTaskActivity?.items.last?.actionable == true)
    }

    @MainActor
    @Test func conversationManagerReconcilesAQuestionAnsweredOnAnotherDevice() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.projectTaskDetails = [
            makeProjectTaskDetail(interaction: makeProjectTaskInteraction()),
            makeProjectTaskDetail(
                task: makeProjectTaskControlTask(status: "running", blockedReason: nil),
                interaction: makeProjectTaskInteraction(status: "resolved")
            )
        ]
        apiClient.answerProjectTaskError = APIClientError.httpStatus(
            409,
            "These questions are no longer waiting for an answer."
        )
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(id: "conversation-1")
        conversation.latestResponse = makeResponse(
            status: "awaiting_input",
            projectId: "project-1",
            projectTaskId: "task-1"
        )
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.refreshCurrentTaskInteraction()
        await manager.answerCurrentTaskQuestions([
            UserQuestionAnswer(questionId: "tone", answer: "Friendly")
        ])

        #expect(manager.currentTaskInteraction?.interaction.status == "resolved")
        #expect(manager.currentTaskInteraction?.submission == .resolvedElsewhere)
        #expect(manager.currentTaskInteraction?.acceptsSubmission == false)
    }

    @MainActor
    @Test func conversationManagerDoesNotRetryTaskAuthorityAfterMembershipIsRevoked() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.projectTaskDetails = [
            makeProjectTaskDetail(
                interaction: makeProjectTaskInteraction(
                    type: "approval",
                    questions: nil,
                    toolName: "use_recipe_connector",
                    reason: "Read the connected service"
                )
            )
        ]
        apiClient.resolveProjectTaskApprovalError = APIClientError.httpStatus(404, "Project not found.")
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(id: "conversation-1")
        conversation.latestResponse = makeResponse(
            status: "awaiting_approval",
            projectId: "project-1",
            projectTaskId: "task-1"
        )
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.refreshCurrentTaskInteraction()
        await manager.resolveCurrentTaskApproval("approved")

        #expect(apiClient.resolvedProjectTaskApprovals.count == 1)
        #expect(manager.currentTaskInteraction?.submission == .failed(
            message: "Project not found.",
            retryable: false
        ))
        #expect(manager.currentTaskInteraction?.acceptsSubmission == false)
    }

    @MainActor
    @Test func conversationManagerRecognisesAnApprovalSavedBeforeProviderInterruption() async throws {
        let apiClient = ConversationAPIClientStub()
        let pendingApproval = makeProjectTaskInteraction(
            type: "approval",
            questions: nil,
            toolName: "use_recipe_connector",
            reason: "Read the connected service"
        )
        let interruptedTask = makeProjectTaskControlTask(
            blockedReason: "dispatch_failed",
            blockedDetail: "The decision was saved, but the provider could not resume."
        )
        let interruptedApproval = makeProjectTaskInteraction(
            type: "approval",
            status: "interrupted",
            questions: nil,
            toolName: "use_recipe_connector",
            reason: "Read the connected service",
            resolution: "approved",
            detail: interruptedTask.blockedDetail
        )
        apiClient.projectTaskDetails = [
            makeProjectTaskDetail(interaction: pendingApproval),
            makeProjectTaskDetail(task: interruptedTask, interaction: interruptedApproval)
        ]
        apiClient.resolveProjectTaskApprovalError = APIClientError.httpStatus(
            503,
            "Provider unavailable"
        )
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(id: "conversation-1")
        conversation.latestResponse = makeResponse(
            status: "awaiting_approval",
            projectId: "project-1",
            projectTaskId: "task-1"
        )
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.refreshCurrentTaskInteraction()
        await manager.resolveCurrentTaskApproval("approved")

        #expect(manager.currentTaskInteraction?.interaction.status == "interrupted")
        #expect(manager.currentTaskInteraction?.interaction.resolution == "approved")
        #expect(manager.currentTaskInteraction?.submission == .acknowledged)
    }

    @MainActor
    @Test func stoppingTheExactRunDoesNotResolveItsPendingDecision() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.projectTaskDetails = [
            makeProjectTaskDetail(interaction: makeProjectTaskInteraction())
        ]
        apiClient.cancelledResponse = makeResponse(
            status: "cancelling",
            projectId: "project-1",
            projectTaskId: "task-1"
        )
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(id: "conversation-1")
        conversation.latestResponse = makeResponse(
            status: "awaiting_input",
            projectId: "project-1",
            projectTaskId: "task-1"
        )
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.refreshCurrentTaskInteraction()
        await manager.cancelCurrentRun()

        #expect(apiClient.cancelledResponses.first?.id == "run-1")
        #expect(apiClient.cancelledResponses.first?.expectedAttempt == 1)
        #expect(manager.currentTaskInteraction?.interaction.status == "pending")
        #expect(manager.currentTaskInteraction?.submission == .idle)
    }

    @MainActor
    @Test func conversationManagerAcknowledgesAndContinuesAnExactConnectorApproval() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.connectorApprovals = [
            makeConnectorApproval(),
            makeConnectorApproval(state: "consumed")
        ]
        apiClient.streamEvents = [.content("Email sent"), .done]
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(
            id: "conversation-1",
            messages: [makeConnectorApprovalMessage()]
        )
        conversation.latestResponse = makeResponse(status: "awaiting_approval")
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.refreshCurrentConnectorApproval()
        await manager.resolveCurrentConnectorApproval("approved")

        #expect(apiClient.resolvedConnectorApprovals.first?.id == "coa_action")
        #expect(apiClient.resolvedConnectorApprovals.first?.resolution == "approved")
        #expect(apiClient.resumedConnectorApprovalId == "coa_action")
        #expect(manager.currentConnectorApproval?.approval.state == "consumed")
        #expect(manager.currentConnectorApproval?.submission == .acknowledged)
    }

    @MainActor
    @Test func conversationManagerReconcilesAConnectorApprovalResolvedElsewhere() async throws {
        let apiClient = ConversationAPIClientStub()
        apiClient.connectorApprovals = [
            makeConnectorApproval(),
            makeConnectorApproval(state: "rejected")
        ]
        apiClient.connectorApprovalResolutionError = APIClientError.httpStatus(
            404,
            "Connector approval is invalid or expired"
        )
        let manager = ConversationManager()
        manager.configure(apiClient: apiClient)
        var conversation = makeConversation(
            id: "conversation-1",
            messages: [makeConnectorApprovalMessage()]
        )
        conversation.latestResponse = makeResponse(status: "awaiting_approval")
        manager.conversations = [conversation]
        manager.currentConversation = conversation

        await manager.refreshCurrentConnectorApproval()
        await manager.resolveCurrentConnectorApproval("approved")

        #expect(manager.currentConnectorApproval?.approval.state == "rejected")
        #expect(manager.currentConnectorApproval?.submission == .resolvedElsewhere)
        #expect(manager.currentConnectorApproval?.acceptsResolution == false)
        #expect(apiClient.resumedConnectorApprovalId == nil)
    }
}
