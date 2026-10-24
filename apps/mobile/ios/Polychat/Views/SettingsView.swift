import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var authManager: AuthenticationManager
    @EnvironmentObject private var modelsStore: ModelsStore
    @EnvironmentObject private var notificationManager: TaskNotificationManager
    @EnvironmentObject private var pushNotificationManager: PushNotificationManager
    @EnvironmentObject private var discoverStore: DiscoverStore
    @EnvironmentObject private var healthSync: HealthSyncController
    @AppStorage("autoTitleGeneration") private var autoTitleGeneration = true
    @State private var showingModelSelector = false
    @State private var confirmingSignOut = false

    var body: some View {
        NavigationStack {
            Form {
                accountSection
                chatSection
                discoverSection
                notificationSection
                aboutSection
            }
            .scrollContentBackground(.hidden)
            .background(Color.polychat.background)
            .navigationTitle("Settings")
            .sheet(isPresented: $showingModelSelector) {
                ModelSelectorView()
            }
            .confirmationDialog("Sign out of Polychat?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) {
                    authManager.logout()
                }
            }
            .task {
                await notificationManager.refresh()
                if discoverStore.discover == nil {
                    await discoverStore.refresh()
                }
            }
        }
    }

    private var accountSection: some View {
        Section {
            if let user = authManager.user {
                HStack(spacing: 12) {
                    Text(String((user.name ?? user.email).prefix(1)).uppercased())
                        .font(.headline)
                        .foregroundStyle(Color.polychat.primaryForeground)
                        .frame(width: 40, height: 40)
                        .background(Color.polychat.primary, in: Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.name ?? user.email)
                            .font(.body.weight(.medium))
                        if user.name != nil {
                            Text(user.email)
                                .font(.caption)
                                .foregroundStyle(Color.polychat.textMuted)
                        }
                    }
                }
            }
            Button("Sign out", role: .destructive) {
                confirmingSignOut = true
            }
        }
    }

    private var chatSection: some View {
        Section {
            Button {
                showingModelSelector = true
            } label: {
                HStack {
                    Text("Default model")
                        .foregroundStyle(Color.polychat.text)
                    Spacer()
                    Text(modelsStore.getSelectedModel()?.name ?? modelsStore.selectedModelTier?.capitalized ?? "Auto")
                        .foregroundStyle(Color.polychat.textMuted)
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.polychat.textMuted)
                }
            }
            Toggle("Name new chats automatically", isOn: $autoTitleGeneration)
        } header: {
            Text("Chat")
        }
    }

    private var discoverSection: some View {
        Section {
            Toggle(
                "Daily editions",
                isOn: Binding(
                    get: { discoverStore.discover?.settings.enabled == true },
                    set: { enabled in Task { await discoverStore.setEnabled(enabled) } }
                )
            )
            .disabled(discoverStore.discover == nil)

            if discoverStore.discover?.settings.enabled == true {
                Toggle(
                    "Evening edition",
                    isOn: Binding(
                        get: { discoverStore.discover?.settings.evening == true },
                        set: { enabled in Task { await discoverStore.setPreference(DiscoverSettingsRequest(evening: enabled)) } }
                    )
                )
                Toggle(
                    "The Perch",
                    isOn: Binding(
                        get: { discoverStore.discover?.settings.listen == true },
                        set: { enabled in Task { await discoverStore.setPreference(DiscoverSettingsRequest(listen: enabled)) } }
                    )
                )
            }

            if healthSync.isAvailable {
                Toggle(
                    "Apple Health",
                    isOn: Binding(
                        get: { healthSync.isEnabled },
                        set: { enabled in Task { await healthSync.setEnabled(enabled) } }
                    )
                )
                .disabled(healthSync.isWorking)

                if let summary = healthSync.lastSummary {
                    LabeledContent("Last shared", value: healthSummaryLine(summary))
                        .font(.footnote)
                }
            }

            if let error = healthSync.error ?? discoverStore.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.error)
            }
        } header: {
            Text("Discover")
        } footer: {
            Text(healthSync.isAvailable
                 ? "The evening edition arrives at 19:00 and looks at tomorrow. Apple Health shares yesterday's sleep, mindful and exercise minutes each morning for one line in your brief, and is never used to choose topics."
                 : "Poly writes an edition each morning from what you've been working on, and a shorter one at 19:00 when the evening edition is on.")
        }
    }

    private var notificationSection: some View {
        Section {
            Toggle("Push notifications", isOn: notificationToggle)
                .disabled(pushNotificationManager.registrationState == .registering)
            notificationCategoryToggle("Decisions and approvals", category: "decisions")
            notificationCategoryToggle("Failures", category: "failures")
            notificationCategoryToggle("Completions", category: "completions")
            notificationCategoryToggle("New assignments", category: "assignments")
        } header: {
            Text("Notifications")
        } footer: {
            Text(notificationStatus)
        }
    }

    private var aboutSection: some View {
        Section {
            Link("Privacy policy", destination: URL(string: "https://polychat.app/privacy")!)
            Link("Terms of service", destination: URL(string: "https://polychat.app/terms")!)
            Link("Open Polychat on the web", destination: URL(string: "https://polychat.app")!)
            LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
        } header: {
            Text("About")
        }
    }

    private func healthSummaryLine(_ summary: DiscoverHealthSummary) -> String {
        let parts = [
            summary.sleepMinutes.map { "\($0 / 60)h \($0 % 60)m sleep" },
            summary.exerciseMinutes.map { "\($0)m exercise" },
            summary.mindfulMinutes.map { "\($0)m mindful" }
        ].compactMap { $0 }

        return parts.isEmpty ? "No data for \(summary.date)" : parts.joined(separator: " · ")
    }

    private var notificationToggle: Binding<Bool> {
        Binding(
            get: {
                notificationManager.settings?.preferences.enabled == true &&
                pushNotificationManager.registrationState == .registered
            },
            set: { enabled in
                Task {
                    if enabled {
                        await notificationManager.enable()
                        if notificationManager.settings?.preferences.enabled == true {
                            await pushNotificationManager.enableForAuthenticatedUser()
                        }
                    } else {
                        await notificationManager.disable()
                        await pushNotificationManager.disableForAuthenticatedUser()
                    }
                }
            }
        )
    }

    private var notificationStatus: String {
        if notificationManager.settings?.preferences.enabled != true {
            return "Notifications are off for this account."
        }

        switch pushNotificationManager.permission {
        case .denied:
            return "iOS is blocking notifications. Allow them for Polychat in the Settings app."
        case .notDetermined:
            return "iOS hasn't asked for permission yet."
        default:
            break
        }

        switch pushNotificationManager.registrationState {
        case .registered:
            return "This iPhone gets approvals, questions and finished work as they happen."
        case .awaitingDeviceToken, .registering:
            return "Registering this iPhone…"
        case .failed(let message):
            return "Registration failed: \(message)"
        case .disabled:
            return "This iPhone isn't registered for notifications."
        case .idle:
            return "Turn on to get approvals and questions on this iPhone."
        }
    }

    private func notificationCategoryToggle(_ label: String, category: String) -> some View {
        Toggle(
            label,
            isOn: Binding(
                get: { notificationCategoryEnabled(category) },
                set: { enabled in
                    Task { await notificationManager.setCategory(category, enabled: enabled) }
                }
            )
        )
        .disabled(pushNotificationManager.registrationState != .registered)
    }

    private func notificationCategoryEnabled(_ category: String) -> Bool {
        guard let preferences = notificationManager.settings?.preferences else {
            return false
        }

        switch category {
        case "decisions": return preferences.decisions
        case "failures": return preferences.failures
        case "completions": return preferences.completions
        case "assignments": return preferences.assignments
        default: return false
        }
    }
}
