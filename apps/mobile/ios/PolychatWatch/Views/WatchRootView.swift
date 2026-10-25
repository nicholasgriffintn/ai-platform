import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var signIn: DeviceSignIn
    @EnvironmentObject private var store: WatchStore

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
    }
}
