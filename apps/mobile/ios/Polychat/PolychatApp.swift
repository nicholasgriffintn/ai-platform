import SwiftUI

@main
struct PolychatApp: App {
    @UIApplicationDelegateAdaptor(PolychatAppDelegate.self) private var appDelegate
    @StateObject private var authManager = AuthenticationManager()
    @StateObject private var conversationManager = ConversationManager()
    @StateObject private var apiClient = APIClient.shared
    @StateObject private var modelsStore = ModelsStore()
    @StateObject private var notificationManager = TaskNotificationManager()
    @StateObject private var pushNotificationManager = PushNotificationManager.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(conversationManager)
                .environmentObject(apiClient)
                .environmentObject(modelsStore)
                .environmentObject(notificationManager)
                .environmentObject(pushNotificationManager)
                .onAppear {
                    authManager.configure(apiClient: apiClient)
                    conversationManager.configure(apiClient: apiClient, modelsStore: modelsStore)
                    notificationManager.configure(apiClient: apiClient)
                    pushNotificationManager.configure(apiClient: apiClient)
                }
        }
    }
}
