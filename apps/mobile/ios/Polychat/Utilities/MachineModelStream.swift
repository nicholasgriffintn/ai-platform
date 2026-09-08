import Foundation

enum MachineModelStream {
    static func make(
        id: String,
        machineId: String,
        modelId: String,
        messages: [ChatMessage],
        conversationId: String,
        create: @escaping (MachineRunRequest) async throws -> MachineRunSnapshot,
        read: @escaping () async throws -> MachineRunSnapshot,
        cancel: @escaping () async throws -> Void
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                var created = false
                do {
                    let prefix = "machine/\(machineId)/"
                    guard machineId.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil,
                          modelId.hasPrefix(prefix) else {
                        throw APIClientError.invalidRequest("Invalid machine model selection")
                    }
                    let model = modelId.dropFirst(prefix.count).split(separator: "/", maxSplits: 1)
                    let providerMessages = ChatMessage.providerMessages(from: messages)
                    guard model.count == 2, !providerMessages.isEmpty,
                          providerMessages.allSatisfy({ message in
                              if case .text = message.content {
                                  return ["user", "assistant", "system"].contains(message.role)
                              }
                              return false
                          }) else {
                        throw APIClientError.invalidRequest("Device models currently support text messages only")
                    }
                    var snapshot = try await create(MachineRunRequest(
                        id: id, conversationId: conversationId, vendor: String(model[0]),
                        nativeModelId: String(model[1]), messages: providerMessages
                    ))
                    created = true
                    var text = ""
                    while true {
                        try Task.checkCancellation()
                        guard snapshot.text.hasPrefix(text) else {
                            throw APIClientError.invalidRequest("The machine returned inconsistent response text")
                        }
                        let delta = String(snapshot.text.dropFirst(text.count))
                        if !delta.isEmpty { continuation.yield(.content(delta)) }
                        text = snapshot.text
                        switch snapshot.state {
                        case "completed":
                            continuation.yield(.done)
                            continuation.finish()
                            return
                        case "cancelled": throw CancellationError()
                        case "failed": throw APIClientError.invalidRequest(snapshot.error ?? "The device model failed")
                        case "pending", "running": break
                        default: throw APIClientError.invalidRequest("Unknown machine run state")
                        }
                        try await Task.sleep(for: .milliseconds(250))
                        snapshot = try await read()
                    }
                } catch {
                    if created { Task { try? await cancel() } }
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
