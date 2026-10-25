import Foundation

@MainActor
final class DeviceSignIn: ObservableObject {
    enum State: Equatable {
        case signedOut
        case starting
        case waiting(DeviceCode)
        case expired
        case signedIn
        case failed(String)
    }

    @Published private(set) var state: State

    private let apiClient: APIClient
    private let tokenStore: KeychainTokenStore
    private var polling: Task<Void, Never>?

    init(apiClient: APIClient = .shared, tokenStore: KeychainTokenStore = .shared) {
        self.apiClient = apiClient
        self.tokenStore = tokenStore
        let stored = try? tokenStore.load()
        if let stored, stored.isUsable {
            apiClient.setAuthToken(stored.value)
            state = .signedIn
        } else {
            state = .signedOut
        }
    }

    var code: DeviceCode? {
        if case .waiting(let code) = state {
            return code
        }
        return nil
    }

    func start(clientName: String, scope: DeviceCredentialScope) async -> DeviceCode? {
        polling?.cancel()
        state = .starting

        do {
            let code = try await apiClient.startDeviceSignIn(clientName: clientName, scope: scope)
            state = .waiting(code)
            polling = Task { [weak self] in
                await self?.poll(code)
            }
            return code
        } catch {
            state = .failed("Sign-in could not start: \(error.localizedDescription)")
            return nil
        }
    }

    func signOut() {
        polling?.cancel()
        tokenStore.clear()
        apiClient.setAuthToken(nil)
        state = .signedOut
    }

    func credentialRejected() {
        signOut()
        state = .failed("This device was signed out. Connect it again to carry on.")
    }

    private func poll(_ code: DeviceCode) async {
        var interval = code.interval

        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(interval))
            guard !Task.isCancelled else { return }

            do {
                let token = try await apiClient.pollDeviceSignIn(deviceCode: code.deviceCode)
                do {
                    try tokenStore.save(StoredAuthToken(value: token.accessToken, expiresAt: .distantFuture))
                } catch {
                    state = .failed("Signed in, but the key could not be kept: \(error.localizedDescription)")
                    return
                }
                apiClient.setAuthToken(token.accessToken)
                state = .signedIn
                return
            } catch APIClientError.httpStatus(400, let reason) {
                switch reason {
                case "authorization_pending":
                    continue
                case "slow_down":
                    interval += 5
                case "access_denied":
                    state = .failed("Sign-in was turned down on the other device.")
                    return
                default:
                    state = .expired
                    return
                }
            } catch APIClientError.httpStatus(let status, let message) {
                state = .failed("Sign-in stopped (\(status)): \(message)")
                return
            } catch {
                continue
            }
        }
    }
}
