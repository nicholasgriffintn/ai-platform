import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var authManager: AuthenticationManager

    var body: some View {
        Group {
            if authManager.isLoading {
                LaunchLoadingView()
            } else if authManager.isAuthenticated {
                RootTabView()
            } else {
                LoginView()
            }
        }
        .onOpenURL { url in
            authManager.handleOpenURL(url)
        }
    }
}

private struct RootTabView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var authManager: AuthenticationManager
    @EnvironmentObject private var conversationManager: ConversationManager
    @EnvironmentObject private var modelsStore: ModelsStore
    @EnvironmentObject private var notificationManager: TaskNotificationManager
    @EnvironmentObject private var pushNotificationManager: PushNotificationManager
    @EnvironmentObject private var polyStore: PolyStore
    @EnvironmentObject private var teammatesStore: TeammatesStore
    @EnvironmentObject private var ageGateStore: AgeGateStore
    @EnvironmentObject private var discoverStore: DiscoverStore
    @EnvironmentObject private var discoverPlayback: DiscoverPlayback
    @EnvironmentObject private var attentionStore: AttentionStore
    @EnvironmentObject private var workStore: WorkStore
    @EnvironmentObject private var healthSync: HealthSyncController
    @EnvironmentObject private var syncClient: DeviceSyncClient
    @State private var selectedTab: AppTab = .home
    @State private var chatsPath: [ChatsRoute] = []
    @State private var workPath: [WorkRoute] = []
    @State private var inboxPath: [WorkRoute] = []
    @State private var outputReviewTarget: OutputReviewTarget?
    @State private var deviceApproval: DeviceApprovalTarget?
    @State private var discoverLink: DiscoverLink?
    @State private var companionSync: CompanionSync?

    private var viewedConversationId: String? {
        let route: String?
        switch selectedTab {
        case .chats: route = chatsPath.last?.conversationId
        case .work: route = workPath.last?.conversationId
        case .attention: route = inboxPath.last?.conversationId
        default: route = nil
        }
        guard route != nil else { return nil }
        return conversationManager.currentConversation?.id
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Home", systemImage: "sun.horizon", value: AppTab.home) {
                HomeView(link: $discoverLink, onOpenConversation: openConversation)
            }

            Tab("Chats", systemImage: "bubble.left.and.bubble.right", value: AppTab.chats) {
                ChatsView(path: $chatsPath)
            }

            Tab("Work", systemImage: "briefcase", value: AppTab.work) {
                WorkView(path: $workPath)
            }

            Tab("Inbox", systemImage: "tray", value: AppTab.attention) {
                AttentionView(path: $inboxPath)
            }
            .badge(attentionStore.badgeCount(notifications: notificationManager.items))

            Tab("Settings", systemImage: "gearshape", value: AppTab.settings) {
                SettingsView()
            }
        }
        .sheet(item: $outputReviewTarget) { target in
            OutputRevisionReviewView(outputId: target.id)
        }
        .sheet(item: $deviceApproval) { target in
            DeviceApprovalSheet(userCode: target.id)
                .presentationDetents([.medium, .large])
        }
        .task {
            await start()
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                syncClient.resume()
                Task { await refreshOnForeground() }
            case .background:
                syncClient.suspend()
            default:
                break
            }
        }
        .onChange(of: viewedConversationId) { _, conversationId in
            syncClient.focus(conversationId: conversationId)
        }
        .onChange(of: notificationManager.items) { _, items in
            Task { await attentionStore.publish(notifications: items) }
        }
        .onChange(of: notificationManager.requestedInboxItemId) { _, itemId in
            if itemId != nil {
                selectedTab = .attention
            }
        }
        .onChange(of: pushNotificationManager.targetToOpen) { _, target in
            guard let target else { return }
            open(target)
        }
        .onChange(of: pushNotificationManager.linkToOpen) { _, url in
            guard let url else { return }
            pushNotificationManager.linkToOpen = nil
            handle(url)
        }
        .onOpenURL(perform: handle)
        .onDisappear {
            Task { await stop() }
        }
    }

    private func start() async {
        ageGateStore.reset()
        if let userId = authManager.user?.id {
            companionSync = CompanionSync(
                client: syncClient,
                conversations: conversationManager,
                attention: attentionStore,
                inbox: notificationManager,
                discover: discoverStore,
                work: workStore
            )
            syncClient.start(userId: userId)
        }

        async let conversations: Void = conversationManager.loadConversations()
        modelsStore.applyAccountDefaults(authManager.userSettings)
        async let models: Void = modelsStore.fetchModels()
        _ = await (conversations, models)

        await notificationManager.reconcileAuthenticatedState(isAuthenticated: true)
        await attentionStore.refresh(notifications: notificationManager.items)
        await pushNotificationManager.enableForAuthenticatedUser()
        await healthSync.syncIfNeeded()
        await bindTeammates()

        if let target = pushNotificationManager.targetToOpen {
            open(target)
        }
    }

    private func stop() async {
        syncClient.stop()
        companionSync = nil
        await pushNotificationManager.unregisterForSignedOutUser()
        polyStore.reset()
        teammatesStore.reset()
        conversationManager.reset()
        discoverStore.reset()
        discoverPlayback.reset()
        workStore.reset()
        healthSync.reset()
        WidgetPublisher.clear()
        await attentionStore.reset()
        await notificationManager.reconcileAuthenticatedState(isAuthenticated: false)
        chatsPath = []
        workPath = []
        inboxPath = []
    }

    private func refreshOnForeground() async {
        companionSync?.refreshEverything()
        await healthSync.syncIfNeeded()
        if selectedTab == .home {
            await discoverStore.refresh()
        }
    }

    private func bindTeammates() async {
        await polyStore.refresh()
        await teammatesStore.refresh()
        conversationManager.bindTeammates(teammatesStore.teammatesByConversation)
        if let polyConversationId = polyStore.agenda?.conversationId {
            conversationManager.bindTeammates([polyConversationId: PolyThread.teammateId])
        }
    }

    private func openConversation(_ conversationId: String) {
        chatsPath = [.conversation(conversationId)]
        selectedTab = .chats
    }

    private func open(_ target: MobileWorkTarget) {
        pushNotificationManager.targetToOpen = nil
        workPath = WorkRoute.routes(to: target)
        selectedTab = .work
    }

    private func handle(_ url: URL) {
        if pushNotificationManager.handleOpenURL(url) {
            return
        }

        notificationManager.handleDeepLink(url)

        if let outputId = OutputReviewDeepLink.outputId(from: url) {
            outputReviewTarget = OutputReviewTarget(id: outputId)
            return
        }

        switch AppRoute.parse(url) {
        case .tab(let tab):
            selectedTab = tab
        case .discover(let link):
            selectedTab = .home
            discoverLink = link
        case .conversation(let id):
            openConversation(id)
        case .device(let userCode):
            deviceApproval = DeviceApprovalTarget(id: userCode)
        case .work(let target):
            open(target)
        case .poly:
            if let conversationId = polyStore.agenda?.conversationId {
                openConversation(conversationId)
            } else {
                selectedTab = .chats
            }
        case nil:
            break
        }
    }
}

private struct OutputReviewTarget: Identifiable {
    let id: String
}

private struct DeviceApprovalTarget: Identifiable {
    let id: String
}

private struct LaunchLoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            PolyMark(size: 74)
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.polychat.background)
    }
}
