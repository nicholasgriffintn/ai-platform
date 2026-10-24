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
    @EnvironmentObject private var attentionStore: AttentionStore
    @EnvironmentObject private var workStore: WorkStore
    @EnvironmentObject private var healthSync: HealthSyncController
    @EnvironmentObject private var syncClient: DeviceSyncClient
    @State private var selectedTab: AppTab = .home
    @State private var chatsPath: [ChatsRoute] = []
    @State private var chatsMode: ChatsMode = .chat
    @State private var workTarget: MobileWorkTarget?
    @State private var outputReviewTarget: OutputReviewTarget?
    @State private var companionSync: CompanionSync?

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Home", systemImage: "sun.horizon", value: AppTab.home) {
                HomeView(onAsk: startConversation)
            }

            Tab("Chats", systemImage: "bubble.left.and.bubble.right", value: AppTab.chats) {
                ChatsView(path: $chatsPath, mode: $chatsMode)
            }

            Tab("Attention", systemImage: "bell", value: AppTab.attention) {
                AttentionView(selectedTarget: $workTarget, onOpenConversation: openConversation)
            }
            .badge(attentionStore.badgeCount(inboxUnread: notificationManager.unread))

            Tab("Settings", systemImage: "gearshape", value: AppTab.settings) {
                SettingsView()
            }
        }
        .sheet(item: $workTarget) { target in
            if let runId = target.runId {
                WorkRunView(runId: runId)
            } else if let taskId = target.taskId {
                WorkTaskView(
                    projectId: target.projectId,
                    taskId: taskId,
                    focusedInteractionId: target.interactionId,
                    onOpenConversation: { conversationId in
                        workTarget = nil
                        openConversation(conversationId)
                    }
                )
            }
        }
        .sheet(item: $outputReviewTarget) { target in
            OutputRevisionReviewView(outputId: target.id)
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
        .onChange(of: conversationManager.currentConversation?.id) { _, conversationId in
            syncClient.focus(conversationId: selectedTab == .chats && !chatsPath.isEmpty ? conversationId : nil)
        }
        .onChange(of: chatsPath) { _, path in
            syncClient.focus(conversationId: path.isEmpty ? nil : conversationManager.currentConversation?.id)
        }
        .onChange(of: notificationManager.unread) { _, unread in
            Task { await attentionStore.publish(inboxUnread: unread) }
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
        await attentionStore.refresh(inboxUnread: notificationManager.unread)
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
        workStore.reset()
        healthSync.reset()
        WidgetPublisher.clear()
        await attentionStore.reset()
        await notificationManager.reconcileAuthenticatedState(isAuthenticated: false)
        chatsPath = []
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
            conversationManager.bindTeammates([polyConversationId: PolyStore.teammateId])
        }
    }

    private func startConversation(_ prompt: String) {
        let conversation = conversationManager.startNewConversation()
        chatsMode = .chat
        chatsPath = [.conversation(conversation.id)]
        selectedTab = .chats

        Task {
            guard await ageGateStore.ensureConfirmed() else { return }
            try? await conversationManager.addMessage(ChatMessage(role: "user", content: prompt))
        }
    }

    private func openConversation(_ conversationId: String) {
        chatsPath = [.conversation(conversationId)]
        selectedTab = .chats
    }

    private func open(_ target: MobileWorkTarget) {
        pushNotificationManager.targetToOpen = nil
        if target.runId != nil || target.taskId != nil {
            selectedTab = .attention
            workTarget = target
        } else if let conversationId = target.conversationId {
            openConversation(conversationId)
        } else {
            selectedTab = .attention
        }
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
        case .conversation(let id):
            openConversation(id)
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
