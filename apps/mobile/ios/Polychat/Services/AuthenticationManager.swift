import AuthenticationServices
import Combine
import Foundation
import UIKit

@MainActor
final class AuthenticationManager: NSObject, ObservableObject {
    @Published private(set) var isAuthenticated = false
    @Published private(set) var isLoading = true
    @Published private(set) var isAuthenticating = false
    @Published private(set) var user: AuthUser?
    @Published var error: String?
    @Published var statusMessage: String?

    var isPro: Bool {
        user?.planId == "pro"
    }

    private let callbackScheme = "polychat"
    private let githubCallbackUri = "polychat://auth/callback"
    private let magicLinkCallbackUri = "polychat://auth/magic-link"
    private let tokenStore: KeychainTokenStore
    private var apiClient: APIClient?
    private var authSession: ASWebAuthenticationSession?

    init(tokenStore: KeychainTokenStore = .shared) {
        self.tokenStore = tokenStore
        super.init()
    }

    func configure(apiClient: APIClient) {
        self.apiClient = apiClient

        Task {
            await restoreSession()
        }
    }

    func restoreSession() async {
        isLoading = true
        error = nil

        if let storedToken = try? tokenStore.load(), storedToken.isUsable {
            apiClient?.setAuthToken(storedToken.value)
            if await refreshUser() {
                isAuthenticated = true
                isLoading = false
                return
            }
        }

        do {
            let token = try await apiClient?.fetchToken()
            if let token {
                try applyToken(token)
                _ = await refreshUser()
            } else {
                clearLocalSession()
            }
        } catch {
            clearLocalSession()
        }

        isLoading = false
    }

    func loginWithGitHub() {
        guard let apiClient else {
            error = "API client is not configured."
            return
        }

        isAuthenticating = true
        error = nil
        statusMessage = nil

        let url = apiClient.authURL(
            path: "/auth/github",
            queryItems: [
                URLQueryItem(name: "platform", value: "mobile"),
                URLQueryItem(name: "redirect_uri", value: githubCallbackUri)
            ]
        )

        let callback = ASWebAuthenticationSession.Callback.customScheme(callbackScheme)
        let session = ASWebAuthenticationSession(url: url, callback: callback) { [weak self] url, error in
            Task { @MainActor in
                await self?.handleGitHubCallback(url: url, error: error)
            }
        }

        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        authSession = session

        if !session.start() {
            isAuthenticating = false
            self.error = "Unable to start the login session."
        }
    }

    func requestMagicLink(email: String) async {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty else {
            error = "Enter your email address."
            return
        }

        isAuthenticating = true
        error = nil
        statusMessage = nil

        do {
            let response = try await apiClient?.requestMagicLink(
                email: trimmedEmail,
                redirectUri: magicLinkCallbackUri
            )
            if response?.success == true {
                statusMessage = "Check your email for a Polychat login link."
            }
        } catch {
            self.error = error.localizedDescription
        }

        isAuthenticating = false
    }

    func handleOpenURL(_ url: URL) {
        guard url.scheme == callbackScheme, url.host == "auth" else {
            return
        }

        if url.path == "/magic-link" {
            Task {
                await handleMagicLinkCallback(url)
            }
        } else if url.path == "/callback" {
            Task {
                await exchangeMobileCode(from: url)
            }
        }
    }

    func logout() {
        Task {
            do {
                _ = try await apiClient?.logout()
            } catch {
                self.error = error.localizedDescription
            }

            clearLocalSession()
        }
    }

    func getAPIKey() -> String {
        (try? tokenStore.load()?.value) ?? ""
    }

    private func handleGitHubCallback(url: URL?, error: Error?) async {
        isAuthenticating = false

        if let error = error as? ASWebAuthenticationSessionError,
           error.code == .canceledLogin {
            return
        }

        if let error {
            self.error = error.localizedDescription
            return
        }

        guard let url else {
            self.error = "Login did not return an authentication code."
            return
        }

        await exchangeMobileCode(from: url)
    }

    private func exchangeMobileCode(from url: URL) async {
        guard let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "code" })?
            .value else {
            error = "Login did not return the mobile authentication code. Deploy the mobile auth API changes and try again."
            return
        }

        isAuthenticating = true
        error = nil

        do {
            if let token = try await apiClient?.exchangeMobileAuthCode(code) {
                try applyToken(token)
                _ = await refreshUser()
            }
        } catch {
            self.error = error.localizedDescription
        }

        isAuthenticating = false
    }

    private func handleMagicLinkCallback(_ url: URL) async {
        let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        guard let token = queryItems?.first(where: { $0.name == "token" })?.value,
              let nonce = queryItems?.first(where: { $0.name == "nonce" })?.value else {
            error = "Magic link callback was missing required parameters."
            return
        }

        isAuthenticating = true
        error = nil
        statusMessage = nil

        do {
            let response = try await apiClient?.verifyMagicLink(token: token, nonce: nonce)
            if response?.success == true, let sessionToken = try await apiClient?.fetchToken() {
                try applyToken(sessionToken)
                _ = await refreshUser()
            }
        } catch {
            self.error = error.localizedDescription
        }

        isAuthenticating = false
    }

    private func applyToken(_ token: TokenResponse) throws {
        let storedToken = StoredAuthToken(
            value: token.token,
            expiresAt: Date().addingTimeInterval(TimeInterval(token.expiresIn))
        )
        try tokenStore.save(storedToken)
        apiClient?.setAuthToken(token.token)
        isAuthenticated = true
    }

    private func refreshUser() async -> Bool {
        do {
            let status = try await apiClient?.fetchAuthStatus()
            user = status?.user
            isAuthenticated = status?.user != nil
            return isAuthenticated
        } catch {
            user = nil
            isAuthenticated = false
            return false
        }
    }

    private func clearLocalSession() {
        tokenStore.clear()
        apiClient?.setAuthToken(nil)
        user = nil
        isAuthenticated = false
        isLoading = false
        clearCookies()
    }

    private func clearCookies() {
        HTTPCookieStorage.shared.cookies?.forEach { cookie in
            if cookie.domain.contains("polychat.app") {
                HTTPCookieStorage.shared.deleteCookie(cookie)
            }
        }
    }
}

extension AuthenticationManager: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
