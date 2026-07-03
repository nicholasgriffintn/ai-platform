import Foundation
import Testing
@testable import Polychat

struct APIClientTests {
    private func makeCompactionMessage() throws -> ChatMessage {
        try JSONDecoder().decode(ChatMessage.self, from: Data("""
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
    }

    @Test func createChatCompletionRejectsRequestsWithNoProviderMessages() async throws {
        let client = APIClient(baseURL: URL(string: "https://example.test")!)

        do {
            _ = try await client.createChatCompletion(
                messages: [try makeCompactionMessage()],
                modelId: "deepseek-chat",
                provider: "deepseek",
                completionId: "conversation-1",
                settings: .default
            )
            Issue.record("Expected invalid request")
        } catch APIClientError.invalidRequest(let message) {
            #expect(message == "Missing required parameter: messages")
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test func streamChatCompletionRejectsRequestsWithNoProviderMessages() async throws {
        let client = APIClient(baseURL: URL(string: "https://example.test")!)
        let stream = client.streamChatCompletion(
            messages: [try makeCompactionMessage()],
            modelId: "deepseek-chat",
            provider: "deepseek",
            completionId: "conversation-1",
            settings: .default
        )

        do {
            for try await _ in stream {}
            Issue.record("Expected invalid request")
        } catch APIClientError.invalidRequest(let message) {
            #expect(message == "Missing required parameter: messages")
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }
}
