import SwiftUI

@main
struct PolychatApp: App {
    @StateObject private var authManager = AuthenticationManager()
    @StateObject private var conversationManager = ConversationManager()
    @StateObject private var apiClient = APIClient()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(conversationManager)
                .environmentObject(apiClient)
                .onAppear {
                    authManager.configure(apiClient: apiClient)
                    conversationManager.configure(apiClient: apiClient, authManager: authManager)
                }
        }
    }
}
