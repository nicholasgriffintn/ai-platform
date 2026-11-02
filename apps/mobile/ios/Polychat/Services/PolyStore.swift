import Foundation

@MainActor
final class PolyStore: ObservableObject {
    @Published private(set) var agenda: PolyAgenda?

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var presence: PolyPresence {
        PolyPresence.derive(from: agenda)
    }

    func refresh() async {
        agenda = try? await apiClient.fetchPolyAgenda()
        WidgetPublisher.publish(agenda: agenda)
    }

    func reset() {
        agenda = nil
    }

    func prepareDiscoverSetup(using conversations: ConversationManager) async -> String? {
        if agenda == nil { await refresh() }
        guard let id = agenda?.conversationId else { return nil }
        conversations.composerPrefill = ComposerPrefill(conversationId: id, text: DiscoverDayForm.setupPrompt)
        return id
    }
}
