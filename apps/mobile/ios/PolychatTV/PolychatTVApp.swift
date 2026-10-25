import SwiftUI

@main
struct PolychatTVApp: App {
    @StateObject private var signIn = DeviceSignIn()
    @StateObject private var store = DiscoverStore()

    var body: some Scene {
        WindowGroup {
            TVRootView()
                .environmentObject(signIn)
                .environmentObject(store)
                .tint(Color.polychat.primary)
        }
    }
}
