import SwiftUI

struct DeviceApprovalSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var authorisation: DeviceAuthorisation?
    @State private var outcome: String?
    @State private var error: String?
    @State private var isWorking = false
    let userCode: String

    private let apiClient = APIClient.shared

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: deviceSymbol)
                .font(.system(size: 44))
                .foregroundStyle(Color.polychat.primary)
                .frame(width: 88, height: 88)
                .background(Color.polychat.selection, in: RoundedRectangle(cornerRadius: 22, style: .continuous))

            if let outcome {
                Text(outcome)
                    .font(.polychatDisplay(.title2))
                    .multilineTextAlignment(.center)
                Button("Done") { dismiss() }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.polychat.primary)
            } else if let authorisation {
                VStack(spacing: 6) {
                    EyebrowLabel("Sign-in request")
                    Text("Connect \(authorisation.clientName)?")
                        .font(.polychatDisplay(.title2))
                    Text(authorisation.userCode)
                        .font(.title3.monospaced().weight(.semibold))
                        .padding(.top, 4)
                    Text("Only approve if the device shows exactly this code.")
                        .font(.footnote)
                        .foregroundStyle(Color.polychat.textMuted)
                }
                .multilineTextAlignment(.center)

                Text(authorisation.scope == .discover
                     ? "It gets a key for Discover only. Chats, projects and files stay out of reach. Revoke it from Profile on the web."
                     : "It gets its own key that can do anything you can. Revoke it from Profile on the web.")
                    .font(.subheadline)
                    .foregroundStyle(Color.polychat.textMuted)
                    .multilineTextAlignment(.center)

                HStack(spacing: 12) {
                    Button("Deny") { decide(approve: false) }
                        .buttonStyle(.bordered)
                    Button("Approve") { decide(approve: true) }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.polychat.primary)
                }
                .controlSize(.large)
                .disabled(isWorking)
            } else if error == nil {
                ProgressView()
            }

            if let error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.error)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.polychat.background)
        .task { await load() }
    }

    private var deviceSymbol: String {
        switch authorisation?.clientName {
        case "Apple TV": return "appletv"
        case "Apple Watch": return "applewatch"
        default: return "desktopcomputer"
        }
    }

    private func load() async {
        do {
            authorisation = try await apiClient.fetchDeviceSignIn(userCode: userCode)
        } catch {
            self.error = "That code has flown the nest. Start sign-in again on the device. (\(error.localizedDescription))"
        }
    }

    private func decide(approve: Bool) {
        guard let authorisation else { return }
        isWorking = true
        Task {
            do {
                _ = try await apiClient.decideDeviceSignIn(userCode: authorisation.userCode, approve: approve)
                outcome = approve
                    ? "\(authorisation.clientName) is signed in"
                    : "\(authorisation.clientName) was turned away"
            } catch {
                self.error = error.localizedDescription
            }
            isWorking = false
        }
    }
}
