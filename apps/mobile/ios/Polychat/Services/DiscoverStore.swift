import Foundation
import UIKit

@MainActor
final class DiscoverStore: ObservableObject {
    @Published private(set) var discover: DiscoverResponse?
    @Published private(set) var covers: [String: UIImage] = [:]
    @Published private(set) var isLoading = false
    @Published private(set) var isWriting = false
    @Published var error: String?
    @Published private(set) var sharesAppleHealth = UserDefaults.standard.bool(forKey: DiscoverStore.appleHealthKey)

    private static let appleHealthKey = "discover.sharesAppleHealth"
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            discover = try await apiClient.fetchDiscover()
            error = nil
            await shareHealthIfEnabled()
            await loadCovers()
        } catch {
            self.error = "Discover could not be reached: \(error.localizedDescription)"
        }
    }

    func setSharesAppleHealth(_ enabled: Bool) async {
        do {
            if enabled {
                try await HealthSummaryService.shared.requestAccess()
                try await apiClient.shareDiscoverHealth(HealthSummaryService.shared.yesterday())
            } else {
                try await apiClient.stopSharingDiscoverHealth()
            }

            sharesAppleHealth = enabled
            UserDefaults.standard.set(enabled, forKey: Self.appleHealthKey)
        } catch {
            self.error = "Apple Health could not be updated: \(error.localizedDescription)"
        }
    }

    private func shareHealthIfEnabled() async {
        guard sharesAppleHealth, HealthSummaryService.shared.isAvailable else { return }

        if let summary = try? await HealthSummaryService.shared.yesterday() {
            try? await apiClient.shareDiscoverHealth(summary)
        }
    }

    func turnOn() async {
        do {
            _ = try await apiClient.updateDiscoverSettings(enabled: true)
            await writeNow()
        } catch {
            self.error = "Discover could not be turned on: \(error.localizedDescription)"
        }
    }

    func writeNow() async {
        do {
            let result = try await apiClient.refreshDiscover()
            isWriting = result.status == "queued"
            await refresh()
        } catch {
            self.error = "Poly could not start the edition: \(error.localizedDescription)"
        }
    }

    func send(_ signal: String, for card: DiscoverCard) async {
        guard let edition = discover?.edition else { return }

        do {
            _ = try await apiClient.sendDiscoverFeedback(
                DiscoverFeedbackRequest(editionId: edition.id, cardId: card.id, signal: signal)
            )
            await refresh()
        } catch {
            self.error = "That feedback did not save: \(error.localizedDescription)"
        }
    }

    func signals(for card: DiscoverCard) -> [String] {
        discover?.edition?.feedback[card.id] ?? []
    }

    private func loadCovers() async {
        let coverIds = (discover?.edition?.cards ?? []).compactMap(\.coverId)

        for coverId in coverIds where covers[coverId] == nil {
            if let data = try? await apiClient.fetchDiscoverCover(coverId: coverId),
               let image = UIImage(data: data) {
                covers[coverId] = image
            }
        }
    }
}
