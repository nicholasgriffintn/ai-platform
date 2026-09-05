import SwiftUI
import UserNotifications

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @EnvironmentObject var notificationManager: TaskNotificationManager
    @State private var showingModelSelector = false
    @State private var autoTitleGeneration = true
    @State private var showingPrivacyPolicy = false
    @State private var showingTerms = false
    @State private var showingHelp = false
    
    var body: some View {
        NavigationStack {
            List {
            Section(header: Text("Model Settings")) {
                HStack {
                    Text("Current Model")
                    Spacer()
                    Button(action: {
                        showingModelSelector = true
                    }) {
                        HStack {
                            if let selectedModel = modelsStore.getSelectedModel() {
                                Text(selectedModel.name ?? selectedModel.id)
                                    .foregroundColor(.blue)
                            } else {
                                Text("Select Model")
                                    .foregroundColor(.blue)
                            }
                            Image(systemName: "chevron.right")
                                .foregroundColor(.gray)
                                .font(.caption)
                        }
                    }
                }
                
                if let selectedModel = modelsStore.getSelectedModel() {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Provider: \(selectedModel.provider)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        if let strengths = selectedModel.strengths, !strengths.isEmpty {
                            Text("Strengths: \(strengths.joined(separator: ", "))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        HStack {
                            if selectedModel.supportsFunctions == true {
                                Text("Functions")
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.green.opacity(0.1))
                                    .foregroundColor(.green)
                                    .cornerRadius(4)
                            }
                            
                            if selectedModel.multimodal == true {
                                Text("Multimodal")
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.purple.opacity(0.1))
                                    .foregroundColor(.purple)
                                    .cornerRadius(4)
                            }
                        }
                    }
                }
            }
            
            Section(header: Text("Chat Settings")) {
                Toggle("Auto-generate titles", isOn: $autoTitleGeneration)
                    .onChange(of: autoTitleGeneration) { _, newValue in
                        UserDefaults.standard.set(newValue, forKey: "autoTitleGeneration")
                    }
            }

            Section(header: Text("Task Notifications")) {
                Toggle("Push notifications", isOn: notificationToggle)
                    .disabled(notificationManager.registrationState == .registering)

                Text(notificationStatus)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                notificationCategoryToggle("Decisions and approvals", category: "decisions")
                notificationCategoryToggle("Meaningful failures", category: "failures")
                notificationCategoryToggle("Useful completions", category: "completions")
                notificationCategoryToggle("New assignments", category: "assignments")
            }
            
            Section(header: Text("Account")) {
                if authManager.isAuthenticated {
                    if let user = authManager.user {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(user.email)
                                .font(.subheadline)
                            if let name = user.name {
                                Text(name)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    Button("Log Out", role: .destructive) {
                        Task {
                            await notificationManager.removeRegistrationForLogout()
                            authManager.logout()
                        }
                    }
                } else {
                    Button("Refresh Login") {
						authManager.logout()
                    }
                }
            }
            
            Section(header: Text("Legal")) {
                Button(action: {
                    showingPrivacyPolicy = true
                }) {
                    HStack {
                        Text("Privacy Policy")
                            .foregroundColor(.primary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundColor(.gray)
                            .font(.caption)
                    }
                }

                Button(action: {
                    showingTerms = true
                }) {
                    HStack {
                        Text("Terms of Service")
                            .foregroundColor(.primary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundColor(.gray)
                            .font(.caption)
                    }
                }

                Button(action: {
                    showingHelp = true
                }) {
                    HStack {
                        Text("Help & Support")
                            .foregroundColor(.primary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundColor(.gray)
                            .font(.caption)
                    }
                }
            }
            
            Section {
                Text("Version 1.0.0")
                    .foregroundColor(.gray)
            }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showingModelSelector) {
                ModelSelectorView()
            }
            .sheet(isPresented: $showingPrivacyPolicy) {
                WebViewScreen(
                    url: URL(string: "https://polychat.app/privacy")!,
                    title: "Privacy Policy"
                )
            }
            .sheet(isPresented: $showingTerms) {
                WebViewScreen(
                    url: URL(string: "https://polychat.app/terms")!,
                    title: "Terms of Service"
                )
            }
            .sheet(isPresented: $showingHelp) {
                WebViewScreen(
                    url: URL(string: "https://nicholasgriffin.dev/contact")!,
                    title: "Help & Support"
                )
            }
            .onAppear {
                autoTitleGeneration = UserDefaults.standard.object(forKey: "autoTitleGeneration") as? Bool ?? true
            }
        }
    }

    private var notificationToggle: Binding<Bool> {
        Binding(
            get: {
                notificationManager.settings?.preferences.enabled == true &&
                notificationManager.registrationState == .registered
            },
            set: { enabled in
                Task {
                    if enabled {
                        await notificationManager.enable()
                    } else {
                        await notificationManager.disable()
                    }
                }
            }
        )
    }

    private var notificationStatus: String {
        switch notificationManager.permission {
        case .denied:
            return "iOS permission is blocked. Allow notifications in Settings, then retry."
        case .notDetermined:
            return "iOS has not asked for notification permission yet."
        default:
            break
        }

        switch notificationManager.registrationState {
        case .registered:
            return "iOS permission and server registration are active."
        case .awaitingDeviceToken, .registering:
            return "iOS permission is active. Waiting for server registration."
        case .failed(let message):
            return "iOS permission and server registration differ: \(message)"
        case .disabled:
            return "Task notifications are disabled for this account."
        case .idle:
            return "Enable notifications to register this device."
        }
    }

    @ViewBuilder
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
        .disabled(notificationManager.registrationState != .registered)
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

#Preview {
    let modelsStore = ModelsStore()
    modelsStore.models = [
        ModelConfigItem(
            id: "gpt-4o",
            name: "GPT-4o",
            provider: "openai",
            description: "Fast multimodal model for everyday work.",
            strengths: ["Reasoning", "Vision", "Code"],
            contextWindow: 128000,
            pricing: nil,
            modalities: nil,
            supportsFunctions: true,
            multimodal: true,
            isFeatured: true
        )
    ]
    modelsStore.selectModel("gpt-4o")

    return SettingsView()
        .environmentObject(AuthenticationManager())
        .environmentObject(modelsStore)
        .environmentObject(TaskNotificationManager())
}
