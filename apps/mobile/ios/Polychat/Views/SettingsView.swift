import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @State private var showingModelSelector = false
    @State private var autoTitleGeneration = true
    
    var body: some View {
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
            
            Section(header: Text("Account")) {
                if authManager.isAuthenticated {
                    Button("Log Out", role: .destructive) {
                        authManager.logout()
                    }
                } else {
                    Button("Log In") {
                        authManager.login()
                    }
                }
            }
            
            Section(header: Text("About")) {
                NavigationLink("Privacy Policy") {
                    Text("Privacy Policy Content")
                }
                NavigationLink("Terms of Service") {
                    Text("Terms of Service Content")
                }
                NavigationLink("Help & Support") {
                    Text("Help Content")
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
        .onAppear {
            autoTitleGeneration = UserDefaults.standard.bool(forKey: "autoTitleGeneration")
        }
    }
}
