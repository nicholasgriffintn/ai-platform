import Foundation
import Testing
@testable import Polychat

struct MachineModelTests {
    @Test func streamsMachineSnapshotsWithoutDuplicatingText() async throws {
        let message = try JSONDecoder().decode(ChatMessage.self, from: Data("""
        {"id":"user-1","role":"user","content":"Hello"}
        """.utf8))
        let stream = MachineModelStream.make(
            id: "run-1", machineId: "desktop-1", modelId: "machine/desktop-1/ollama/gemma3:1b",
            messages: [message], conversationId: "conversation-1",
            create: { request in
                #expect(request.vendor == "ollama")
                #expect(request.nativeModelId == "gemma3:1b")
                #expect(request.messages.first?.textContent == "Hello")
                return MachineRunSnapshot(id: "run-1", state: "running", text: "Hel", error: nil)
            },
            read: { MachineRunSnapshot(id: "run-1", state: "completed", text: "Hello", error: nil) },
            cancel: { Issue.record("A completed run should not be cancelled") }
        )
        var events: [ChatStreamEvent] = []
        for try await event in stream { events.append(event) }
        #expect(events == [.content("Hel"), .content("lo"), .done])
    }

    @Test func decodesAdvertisedMachineCapabilities() throws {
        let model = try JSONDecoder().decode(MachineModel.self, from: Data("""
        {"nativeId":"gemma3:1b","displayName":"Gemma","contextTokens":null,
         "capabilities":{"tools":false,"vision":false,"thinking":false},"loaded":true}
        """.utf8))
        #expect(model.nativeId == "gemma3:1b")
        #expect(model.capabilities.vision == false)
    }
}
