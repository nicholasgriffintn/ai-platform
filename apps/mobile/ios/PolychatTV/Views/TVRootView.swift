import SwiftUI

struct TVRootView: View {
    @EnvironmentObject private var signIn: DeviceSignIn
    @EnvironmentObject private var store: DiscoverStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var path: [TVRoute] = []
    @State private var name: String?

    var body: some View {
        Group {
            if signIn.state == .signedIn {
                NavigationStack(path: $path) {
                    TVHomeView(name: name)
                        .navigationDestination(for: TVRoute.self) { route in
                            switch route {
                            case .episode:
                                TVEpisodeView()
                            case .perch:
                                TVListenView(item: .perch)
                            case .week:
                                TVListenView(item: .week)
                            case .windDown:
                                TVWindDownView()
                            case .card(let id):
                                TVCardView(cardId: id)
                            }
                        }
                }
            } else {
                TVSignInView()
            }
        }
        .onOpenURL { url in
            if let route = TVRoute(url: url) {
                path = [route]
            }
        }
        .task(id: signIn.state == .signedIn) {
            if signIn.state == .signedIn {
                await load()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, signIn.state == .signedIn {
                Task { await load() }
            }
        }
        .onChange(of: store.credentialRejected) { _, rejected in
            if rejected {
                TopShelfStore.clear()
                signIn.credentialRejected()
            }
        }
    }

    private func load() async {
        async let profile = try? APIClient.shared.fetchAuthStatus()
        await store.refresh()
        name = await profile?.user?.name
        TopShelfPublisher.publish(from: store)
    }
}
