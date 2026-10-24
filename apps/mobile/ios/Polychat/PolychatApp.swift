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
    @StateObject private var polyStore = PolyStore()
    @StateObject private var teammatesStore = TeammatesStore()
    @StateObject private var ageGateStore = AgeGateStore()
    @StateObject private var discoverStore = DiscoverStore()
    @StateObject private var attentionStore = AttentionStore()
    @StateObject private var workStore = WorkStore()
    @StateObject private var healthSync = HealthSyncController.shared
    @StateObject private var syncClient = DeviceSyncClient()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(conversationManager)
                .environmentObject(apiClient)
                .environmentObject(modelsStore)
                .environmentObject(notificationManager)
                .environmentObject(pushNotificationManager)
                .environmentObject(polyStore)
                .environmentObject(teammatesStore)
                .environmentObject(ageGateStore)
                .environmentObject(discoverStore)
                .environmentObject(attentionStore)
                .environmentObject(workStore)
                .environmentObject(healthSync)
                .environmentObject(syncClient)
                .tint(Color.polychat.primary)
                .onAppear {
                    authManager.configure(apiClient: apiClient)
                    conversationManager.configure(apiClient: apiClient, modelsStore: modelsStore)
                    notificationManager.configure(apiClient: apiClient)
                    pushNotificationManager.configure(apiClient: apiClient)
                }
        }
        .backgroundTask(.appRefresh(HealthSyncController.refreshTaskId)) {
            await HealthSyncController.shared.syncIfNeeded()
        }
    }
}
