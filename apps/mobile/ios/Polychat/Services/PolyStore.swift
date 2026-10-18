import Foundation

@MainActor
final class PolyStore: ObservableObject {
    nonisolated static let teammateId = "platform-poly"

    @Published private(set) var agenda: PolyAgenda?
    @Published private(set) var isLoading = false
    @Published var error: String?

    private let apiClient: APIClient
    private let liveActivity = PolyLiveActivityController()

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var presence: PolyPresence {
        PolyPresence.derive(from: agenda)
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            agenda = try await apiClient.fetchPolyAgenda()
            error = nil
        } catch {
            self.error = "Poly could not be reached: \(error.localizedDescription)"
        }

        await liveActivity.sync(agenda: agenda, presence: presence)
    }

    func pause(until: Date?) async {
        guard let agenda else { return }

        do {
            try await apiClient.setPolyPause(contextId: agenda.contextId, until: until)
            await refresh()
        } catch {
            self.error = "Poly could not change its pause: \(error.localizedDescription)"
        }
    }

    func setLookAround(_ enabled: Bool) async {
        do {
            _ = try await apiClient.setPolyLookAround(enabled: enabled)
            await refresh()
        } catch {
            self.error = "Poly could not change its morning look: \(error.localizedDescription)"
        }
    }

    func reset() async {
        agenda = nil
        await liveActivity.sync(agenda: nil, presence: presence)
    }
}
