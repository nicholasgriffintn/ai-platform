import SwiftUI
import WidgetKit

struct WatchRootView: View {
    @EnvironmentObject private var signIn: DeviceSignIn
    @EnvironmentObject private var store: WatchStore
    @EnvironmentObject private var perch: PerchStore

    var body: some View {
        Group {
            if signIn.state == .signedIn {
                WatchHomeView()
            } else {
                WatchSignInView()
            }
        }
        .onChange(of: store.credentialRejected) { _, rejected in
            if rejected {
                signIn.credentialRejected()
            }
        }
        .onChange(of: signIn.state) { _, state in
            if state != .signedIn {
                clearAccountData()
            }
        }
    }

    private func clearAccountData() {
        WidgetSnapshotStore.clear()
        PerchStorage.clear()
        perch.reset()
    }
}
