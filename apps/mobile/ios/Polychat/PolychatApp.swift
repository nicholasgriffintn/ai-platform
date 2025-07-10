import SwiftUI

@main
struct PolychatApp: App {
    @StateObject private var authManager = AuthenticationManager()
    @StateObject private var conversationManager = ConversationManager()
    @StateObject private var apiClient = APIClient.shared
    @StateObject private var modelsStore = ModelsStore()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(conversationManager)
                .environmentObject(apiClient)
                .environmentObject(modelsStore)
                .onAppear {
                    authManager.configure(apiClient: apiClient)
                    conversationManager.configure(apiClient: apiClient, authManager: authManager, modelsStore: modelsStore)
                    
                    // Fetch models when app appears
                    Task {
                        await modelsStore.fetchModels()
                    }
                }
        }
    }
}
