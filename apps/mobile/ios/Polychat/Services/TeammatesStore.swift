import Foundation

@MainActor
final class TeammatesStore: ObservableObject {
    @Published private(set) var roster: [TeammateRosterEntry] = []
    @Published private(set) var teammates: [TeammateSummary] = []
    @Published private(set) var isLoading = false
    @Published var error: String?

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var rows: [TeammateRosterRow] {
        TeammateRoster.rows(entries: roster, teammates: teammates)
    }

    var startable: [TeammateSummary] {
        TeammateRoster.teammatesWithoutConversations(entries: roster, teammates: teammates)
            .filter { $0.id != PolyThread.teammateId }
    }

    var teammatesByConversation: [String: String] {
        TeammateRoster.teammatesByConversation(roster)
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            async let roster = apiClient.fetchTeammateRoster()
            async let teammates = apiClient.fetchTeammates()
            (self.roster, self.teammates) = try await (roster, teammates)
            error = nil
        } catch {
            self.error = "Your teammates could not be loaded: \(error.localizedDescription)"
        }
    }

    func reset() {
        roster = []
        teammates = []
        error = nil
    }
}
