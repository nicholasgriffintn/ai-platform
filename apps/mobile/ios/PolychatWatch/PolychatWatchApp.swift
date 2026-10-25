import SwiftUI

@main
struct PolychatWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchAppDelegate.self) private var appDelegate
    @StateObject private var signIn = DeviceSignIn()
    @StateObject private var store = WatchStore()
    @StateObject private var companion = WatchCompanion.shared

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(signIn)
                .environmentObject(store)
                .environmentObject(companion)
                .tint(Color.polychat.primary)
        }
    }
}
