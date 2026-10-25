import SwiftUI

struct WatchSignInView: View {
    @EnvironmentObject private var signIn: DeviceSignIn
    @EnvironmentObject private var companion: WatchCompanion
    @State private var phoneError: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                PolyMark(size: 44)

                switch signIn.state {
                case .starting:
                    ProgressView()
                case .waiting(let code):
                    Text(code.userCode)
                        .font(.title3.monospaced().weight(.semibold))
                    if let phoneError {
                        Text(phoneError)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    Text(companion.phoneReachable && phoneError == nil
                         ? "Approving on your iPhone. If nothing happens, enter this code at \(URLDisplay.hostAndPath(code.verificationUri))."
                         : "Enter this code at \(URLDisplay.hostAndPath(code.verificationUri)) on any signed-in device.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    ProgressView()
                default:
                    Text("Keep Poly on your wrist")
                        .font(.headline)
                        .multilineTextAlignment(.center)
                    if signIn.state == .expired {
                        Text("That code expired before anyone approved it.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    if case .failed(let message) = signIn.state {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    if let phoneError {
                        Text(phoneError)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    if companion.phoneReachable {
                        Button("Sign in with iPhone") {
                            Task { await connect(viaPhone: true) }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    Button("Use a code") {
                        Task { await connect(viaPhone: false) }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private func connect(viaPhone: Bool) async {
        phoneError = nil
        guard let code = await signIn.start(clientName: "Apple Watch", scope: .full), viaPhone else {
            return
        }

        do {
            try await companion.approveOnPhone(userCode: code.userCode)
        } catch {
            phoneError = error.localizedDescription
        }
    }
}
