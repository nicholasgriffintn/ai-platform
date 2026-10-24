import Foundation

@MainActor
final class DeviceSyncClient: ObservableObject {
    enum Status {
        case idle
        case connecting
        case open
        case closed
    }

    @Published private(set) var status: Status = .idle

    var onEvent: ((DeviceSyncEvent) -> Void)?
    var onReconnect: (() -> Void)?

    private let apiClient: APIClient
    private let session = URLSession(configuration: .default)
    private var socket: URLSessionWebSocketTask?
    private var topics: Set<String> = []
    private var cursors: [String: Int] = [:]
    private var focusedTopic: String?
    private var isRunning = false
    private var hasOpened = false
    private var retryDelay: Duration = .seconds(1)
    private var connectionTask: Task<Void, Never>?
    private var pingTask: Task<Void, Never>?

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func start(userId: Int) {
        topics.insert("user:\(userId)")
        guard !isRunning else { return }
        isRunning = true
        connect()
    }

    func stop() {
        isRunning = false
        hasOpened = false
        connectionTask?.cancel()
        pingTask?.cancel()
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        topics = []
        cursors = [:]
        focusedTopic = nil
        status = .idle
    }

    func suspend() {
        guard isRunning else { return }
        connectionTask?.cancel()
        pingTask?.cancel()
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        status = .closed
    }

    func resume() {
        guard isRunning, socket == nil else { return }
        retryDelay = .seconds(1)
        connect()
    }

    func focus(conversationId: String?) {
        let topic = conversationId.map { "conversation:\($0)" }
        guard topic != focusedTopic else { return }

        if let previous = focusedTopic {
            topics.remove(previous)
            send(.unsubscribe([previous]))
        }

        focusedTopic = topic
        if let topic {
            topics.insert(topic)
            send(.subscribe([DeviceSyncSubscription(topic: topic, lastSeq: cursors[topic])]))
        }
        send(.focus(topic))
    }

    private func connect() {
        connectionTask?.cancel()
        connectionTask = Task { [weak self] in
            await self?.openSocket()
        }
    }

    private func openSocket() async {
        status = .connecting

        do {
            let grant = try await apiClient.requestSyncGrant(deviceId: DeviceIdentity.id)
            guard isRunning, !Task.isCancelled,
                  var components = URLComponents(string: grant.socketUrl) else {
                return
            }

            components.queryItems = [
                URLQueryItem(name: "grant", value: grant.token),
                URLQueryItem(name: "device_id", value: DeviceIdentity.id)
            ]
            guard let url = components.url else { return }

            let socket = session.webSocketTask(with: url)
            self.socket = socket
            socket.resume()
            status = .open
            retryDelay = .seconds(1)
            resubscribe()
            startPinging()

            if hasOpened {
                onReconnect?()
            }
            hasOpened = true

            try await receive(on: socket)
        } catch is CancellationError {
            return
        } catch {
            guard isRunning, !Task.isCancelled else { return }
        }

        socket = nil
        pingTask?.cancel()
        guard isRunning, !Task.isCancelled else { return }
        status = .closed
        await scheduleReconnect()
    }

    private func receive(on socket: URLSessionWebSocketTask) async throws {
        while !Task.isCancelled {
            let message = try await socket.receive()
            let data: Data
            switch message {
            case .string(let text):
                data = Data(text.utf8)
            case .data(let payload):
                data = payload
            @unknown default:
                continue
            }
            handle(DeviceSyncServerMessage(json: data))
        }
    }

    private func handle(_ message: DeviceSyncServerMessage) {
        switch message {
        case .event(let event):
            cursors[event.topic] = event.seq
            onEvent?(event)
        case .subscribed(let topic, let seq), .reset(let topic, let seq):
            cursors[topic] = seq
            if case .reset = message {
                onReconnect?()
            }
        case .other:
            break
        }
    }

    private func resubscribe() {
        guard !topics.isEmpty else { return }
        send(.subscribe(topics.map { DeviceSyncSubscription(topic: $0, lastSeq: cursors[$0]) }))
        if let focusedTopic {
            send(.focus(focusedTopic))
        }
    }

    private func startPinging() {
        pingTask?.cancel()
        pingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(25))
                self?.send(.ping)
            }
        }
    }

    private func scheduleReconnect() async {
        try? await Task.sleep(for: retryDelay)
        retryDelay = min(retryDelay * 2, .seconds(30))
        guard isRunning, !Task.isCancelled else { return }
        connect()
    }

    private func send(_ message: DeviceSyncClientMessage) {
        guard let socket, let data = try? JSONEncoder().encode(message),
              let text = String(data: data, encoding: .utf8) else {
            return
        }
        socket.send(.string(text)) { _ in }
    }
}
