import Foundation
import Testing
@testable import Polychat

struct ServiceStoreTests {
    @MainActor
    @Test func modelsStoreFetchesModelsSelectsFirstAndPersistsSelection() async throws {
        let defaults = try makeIsolatedUserDefaults()
        let client = ModelsAPIClientStub(result: .success([
            "gpt-4o": makeModel(id: "", name: "GPT-4o", provider: "openai"),
            "mistral-small": makeModel(id: "", name: "Mistral Small", provider: "mistral")
        ]))
        let store = ModelsStore(apiClient: client, userDefaults: defaults)

        await store.fetchModels()

        #expect(store.error == nil)
        #expect(store.models.map(\.id).sorted() == ["gpt-4o", "mistral-small"])
        #expect(store.selectedModelId != nil)

        store.selectModel("gpt-4o")
        #expect(defaults.string(forKey: "selectedModelId") == "gpt-4o")
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
    @Test func toolsStoreFetchesToolsAndReportsErrors() async {
        let tool = ToolDefinition(id: "web", name: "Web", description: "Search", isDefault: true)
        let store = ToolsStore(apiClient: ToolsAPIClientStub(result: .success([tool])))

        await store.fetchTools()

        #expect(store.tools == [tool])
        #expect(store.error == nil)
        #expect(!store.isLoading)

        let failingStore = ToolsStore(apiClient: ToolsAPIClientStub(result: .failure(TestFailure.forced)))
        await failingStore.fetchTools()

        #expect(failingStore.tools.isEmpty)
        #expect(failingStore.error?.contains("Failed to fetch tools") == true)
        #expect(!failingStore.isLoading)
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
            .content("!"),
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

        #expect(apiClient.streamedCompletionId == conversation.id)
        #expect(apiClient.streamedModelId == "gpt-4o")
        #expect(apiClient.streamedMessages.map(\.role) == ["user"])
        #expect(manager.currentConversation?.messages.map(\.role) == ["user", "assistant"])
        #expect(manager.currentConversation?.messages.last?.id == "server-message")
        #expect(manager.currentConversation?.messages.last?.textContent == "Hello there!")
        #expect(manager.currentConversation?.messages.last?.model == "gpt-4o")
        #expect(manager.currentConversation?.messages.last?.reasoning?.content == "Reasoned")
        #expect(manager.currentConversation?.messages.last?.citations?.first?.url == "https://example.com")
        #expect(manager.currentConversation?.messages.last?.status == "complete")
        #expect(manager.currentConversation?.messages.last?.logId == "log-1")
        #expect(manager.currentConversation?.messages.last?.created == 1_774_000_000)
        #expect(manager.currentConversation?.title == "Generated title")
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
}
