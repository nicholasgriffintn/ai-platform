import Foundation

@MainActor
final class PolyStore: ObservableObject {
    nonisolated static let teammateId = "platform-poly"

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
}
