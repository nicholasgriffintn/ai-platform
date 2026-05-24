import AuthenticationServices
import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @Environment(\.colorScheme) private var colorScheme
    @State private var email = ""

    private let authControlHeight: CGFloat = 48
    private let authControlCornerRadius: CGFloat = 10
    private let authControlFont = Font.system(size: 19, weight: .semibold)

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer(minLength: 28)

                VStack(spacing: 14) {
                    PolychatLogoView(size: 82)

                    VStack(spacing: 8) {
                        Text("Polychat")
                            .font(.largeTitle.weight(.bold))
                        Text("Sign in to sync conversations, models, and chat history.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }

                VStack(spacing: 14) {
                    SignInWithAppleButton(
                        .signIn,
                        onRequest: authManager.prepareAppleSignInRequest,
                        onCompletion: authManager.handleAppleSignInCompletion
                    )
                    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                    .frame(maxWidth: .infinity)
                    .frame(height: authControlHeight)
                    .clipShape(RoundedRectangle(cornerRadius: authControlCornerRadius, style: .continuous))
                    .disabled(authManager.isAuthenticating)

                    Button {
                        authManager.loginWithGitHub()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "person.crop.circle.badge.checkmark")
                            Text(authManager.isAuthenticating ? "Signing in..." : "Continue with GitHub")
                        }
                        .font(authControlFont)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: authControlHeight)
                        .background(Color.blue)
                        .clipShape(RoundedRectangle(cornerRadius: authControlCornerRadius, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(authManager.isAuthenticating)

                    HStack(spacing: 12) {
                        Rectangle()
                            .frame(height: 1)
                            .foregroundStyle(Color(.separator))
                        Text("or")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Rectangle()
                            .frame(height: 1)
                            .foregroundStyle(Color(.separator))
                    }

                    VStack(spacing: 10) {
                        TextField("Email address", text: $email)
                            .font(authControlFont)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(.horizontal, 20)
                            .frame(maxWidth: .infinity)
                            .frame(height: authControlHeight)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: authControlCornerRadius, style: .continuous))

                        Button {
                            Task {
                                await authManager.requestMagicLink(email: email)
                            }
                        } label: {
                            Label("Email me a login link", systemImage: "envelope")
                                .font(authControlFont)
                                .foregroundStyle(Color.blue)
                                .frame(maxWidth: .infinity)
                                .frame(height: authControlHeight)
                                .background(Color(.secondarySystemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: authControlCornerRadius, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(authManager.isAuthenticating)
                    }
                }

                if authManager.isAuthenticating {
                    ProgressView()
                }

                if let statusMessage = authManager.statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(Color.polychat.success)
                        .multilineTextAlignment(.center)
                }

                if let error = authManager.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color.polychat.error)
                        .multilineTextAlignment(.center)
                }

                Spacer()
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthenticationManager())
}
