import Foundation

@MainActor
final class AgeGateStore: ObservableObject {
    @Published private(set) var status: AgeGateStatus?
    @Published var isPrompting = false
    @Published private(set) var isConfirming = false
    @Published private(set) var error: String?

    private let apiClient: any AgeGateAPIClient
    private var pendingDecision: CheckedContinuation<Bool, Never>?

    init(apiClient: any AgeGateAPIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    func ensureConfirmed() async -> Bool {
        if status == nil {
            status = try? await apiClient.fetchAgeGate().status
        }

        guard let status, !status.allowsSending else {
            return true
        }

        finish(allowed: false)
        error = nil
        isPrompting = true

        return await withCheckedContinuation { continuation in
            pendingDecision = continuation
        }
    }

    func confirm(birthDate: Date, calendar: Calendar = .current) async {
        isConfirming = true
        error = nil

        defer {
            isConfirming = false
        }

        do {
            let response = try await apiClient.confirmAge(
                birthDate: CalendarDate.string(from: birthDate, calendar: calendar)
            )
            status = response.status

            if response.status.allowsSending {
                finish(allowed: true)
            }
        } catch APIClientError.httpStatus(_, let message) {
            error = message
        } catch {
            self.error = error.localizedDescription
        }
    }

    func skip() {
        finish(allowed: false)
    }

    func reset() {
        finish(allowed: false)
        status = nil
        error = nil
    }

    private func finish(allowed: Bool) {
        isPrompting = false
        pendingDecision?.resume(returning: allowed)
        pendingDecision = nil
    }
}
