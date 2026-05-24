import Foundation

final class APIClient: ObservableObject {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let userAgent: String
    private var authToken: String?

    private init(
        baseURL: URL = APIClient.defaultBaseURL(),
        session: URLSession = .shared,
        userAgent: String = APIClient.defaultUserAgent()
    ) {
        self.baseURL = baseURL
        self.session = session
        self.userAgent = userAgent
    }

    func setAuthToken(_ token: String?) {
        self.authToken = token
    }

    func authURL(path: String, queryItems: [URLQueryItem] = []) -> URL {
        buildURL(path: path, queryItems: queryItems)
    }

    func fetchAuthStatus() async throws -> AuthStatusResponse {
        try await send(path: "/auth/me", method: "GET")
    }

    func fetchToken() async throws -> TokenResponse {
        try await send(path: "/auth/token", method: "GET")
    }

    func exchangeMobileAuthCode(_ code: String) async throws -> TokenResponse {
        try await send(
            path: "/auth/mobile/exchange",
            method: "POST",
            body: MobileAuthExchangeRequest(code: code)
        )
    }

    func signInWithApple(identityToken: String, nonce: String, fullName: String?) async throws -> TokenResponse {
        try await send(
            path: "/auth/apple",
            method: "POST",
            body: AppleSignInRequest(identityToken: identityToken, nonce: nonce, fullName: fullName)
        )
    }

    func requestMagicLink(email: String, redirectUri: String) async throws -> SuccessResponse {
        try await send(
            path: "/auth/magic-link/request",
            method: "POST",
            body: MagicLinkRequest(email: email, redirectUri: redirectUri)
        )
    }

    func verifyMagicLink(token: String, nonce: String) async throws -> SuccessResponse {
        try await send(
            path: "/auth/magic-link/verify",
            method: "POST",
            body: MagicLinkVerifyRequest(token: token, nonce: nonce)
        )
    }

    func logout() async throws -> SuccessResponse {
        try await send(path: "/auth/logout", method: "POST", emptyBody: true)
    }

    func createChatCompletion(
        messages: [ChatMessage],
        modelId: String?,
        completionId: String? = nil,
        settings: ChatSettings? = nil
    ) async throws -> ChatCompletionResponse {
        let requestBody = ChatCompletionRequest(
            messages: messages,
            model: modelId,
            store: true,
            completionId: completionId,
            settings: settings
        )

        return try await send(path: "/chat/completions", method: "POST", body: requestBody)
    }

    func streamChatCompletion(
        messages: [ChatMessage],
        modelId: String?,
        completionId: String? = nil,
        settings: ChatSettings? = nil
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let requestBody = ChatCompletionRequest(
            messages: messages,
            model: modelId,
            store: true,
            completionId: completionId,
            settings: settings,
            stream: true
        )

        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    try await stream(path: "/chat/completions", method: "POST", body: requestBody, continuation: continuation)
                } catch {
                    continuation.finish(throwing: error)
                }
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    func fetchModels() async throws -> ModelsResponse {
        try await send(path: "/models", method: "GET")
    }

    func fetchTools() async throws -> [ToolDefinition] {
        try await send(path: "/tools", method: "GET")
    }

    func generateTitle(conversationId: String, messages: [ChatMessage]) async throws -> TitleGenerationResponse {
        try await send(
            path: "/chat/completions/\(conversationId)/generate-title",
            method: "POST",
            body: TitleGenerationRequest(messages: messages)
        )
    }

    func fetchConversations(
        limit: Int = 50,
        page: Int = 1,
        includeArchived: Bool = false
    ) async throws -> ConversationListResponse {
        try await send(
            path: "/chat/completions",
            method: "GET",
            queryItems: [
                URLQueryItem(name: "limit", value: String(limit)),
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "include_archived", value: String(includeArchived))
            ]
        )
    }

    func fetchConversation(id: String, refreshPending: Bool = true) async throws -> ConversationDetailResponse {
        try await send(
            path: "/chat/completions/\(id)",
            method: "GET",
            queryItems: refreshPending ? [URLQueryItem(name: "refresh_pending", value: "true")] : []
        )
    }

    func updateConversation(id: String, title: String) async throws {
        let _: EmptyResponse = try await send(
            path: "/chat/completions/\(id)",
            method: "PUT",
            body: UpdateConversationRequest(title: title)
        )
    }

    func deleteConversation(id: String) async throws {
        let _: SuccessResponse = try await send(path: "/chat/completions/\(id)", method: "DELETE")
    }

    func uploadFile(
        data: Data,
        fileName: String,
        mimeType: String,
        fileType: String,
        convertToMarkdown: Bool = false
    ) async throws -> UploadResponse {
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        body.appendMultipartField(name: "file_type", value: fileType, boundary: boundary)
        if convertToMarkdown {
            body.appendMultipartField(name: "convert_to_markdown", value: "true", boundary: boundary)
        }
        body.appendMultipartFile(
            name: "file",
            fileName: fileName,
            mimeType: mimeType,
            data: data,
            boundary: boundary
        )
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        return try await send(
            path: "/uploads",
            method: "POST",
            bodyData: body,
            contentType: "multipart/form-data; boundary=\(boundary)"
        )
    }

    func transcribeAudio(data: Data, fileName: String, mimeType: String) async throws -> TranscriptionResponse {
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        body.appendMultipartFile(
            name: "audio",
            fileName: fileName,
            mimeType: mimeType,
            data: data,
            boundary: boundary
        )
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        return try await send(
            path: "/audio/transcribe",
            method: "POST",
            bodyData: body,
            contentType: "multipart/form-data; boundary=\(boundary)"
        )
    }

    func initialize() async throws {
        if authToken == nil, let storedToken = try KeychainTokenStore.shared.load(), storedToken.isUsable {
            authToken = storedToken.value
        }
    }

    private func send<T: Decodable, Body: Encodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        body: Body
    ) async throws -> T {
        let bodyData = try JSONEncoder().encode(body)
        return try await send(
            path: path,
            method: method,
            queryItems: queryItems,
            bodyData: bodyData,
            contentType: "application/json"
        )
    }

    private func send<T: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        emptyBody: Bool = false
    ) async throws -> T {
        try await send(
            path: path,
            method: method,
            queryItems: queryItems,
            bodyData: emptyBody ? Data("{}".utf8) : nil,
            contentType: emptyBody ? "application/json" : nil
        )
    }

    private func send<T: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        bodyData: Data?,
        contentType: String?
    ) async throws -> T {
        let request = makeRequest(
            path: path,
            method: method,
            queryItems: queryItems,
            bodyData: bodyData,
            contentType: contentType
        )

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)

        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func stream<Body: Encodable>(
        path: String,
        method: String,
        body: Body,
        continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) async throws {
        let bodyData = try JSONEncoder().encode(body)
        let request = makeRequest(
            path: path,
            method: method,
            bodyData: bodyData,
            contentType: "application/json"
        )

        let (bytes, response) = try await session.bytes(for: request)
        try validate(response: response, data: Data())

        let contentType = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type") ?? ""
        guard contentType.localizedCaseInsensitiveContains("text/event-stream") else {
            var data = Data()
            for try await byte in bytes {
                data.append(byte)
            }

            let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
            let content = response.choices.first?.message.content.textValue ?? ""
            if !content.isEmpty {
                continuation.yield(.content(content))
            }
            continuation.yield(.done)
            continuation.finish()
            return
        }

        var eventData = ""
        for try await line in bytes.lines {
            if Task.isCancelled {
                return
            }

            if line.isEmpty {
                try processServerSentEvent(eventData, continuation: continuation)
                eventData = ""
                continue
            }

            if line.hasPrefix("data:") {
                let dataLine = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                eventData += dataLine
            }
        }

        if !eventData.isEmpty {
            try processServerSentEvent(eventData, continuation: continuation)
        }

        continuation.finish()
    }

    private func makeRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        bodyData: Data?,
        contentType: String?
    ) -> URLRequest {
        var request = URLRequest(url: buildURL(path: path, queryItems: queryItems))
        request.httpMethod = method
        request.setValue("mobile", forHTTPHeaderField: "X-Platform")
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }

        if let authToken {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = bodyData
        return request
    }

    private func processServerSentEvent(
        _ data: String,
        continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) throws {
        guard !data.isEmpty else {
            return
        }

        if data == "[DONE]" {
            continuation.yield(.done)
            return
        }

        guard let jsonData = data.data(using: .utf8),
              let object = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            return
        }

        if let type = object["type"] as? String {
            switch type {
            case "error":
                let message = ((object["error"] as? [String: Any])?["message"] as? String) ??
                    (object["error"] as? String) ??
                    "Streaming failed"
                throw APIClientError.streaming(message)
            case "content_block_delta":
                if let content = object["content"] as? String {
                    continuation.yield(.content(content))
                }
            case "thinking_delta":
                if let thinking = object["thinking"] as? String {
                    continuation.yield(.reasoning(thinking))
                }
            case "state":
                if let state = object["state"] as? String {
                    continuation.yield(.state(state))
                }
            case "message_stop":
                continuation.yield(.done)
            case "message_delta":
                if let messageId = object["message_id"] as? String {
                    continuation.yield(.metadata(messageId: messageId))
                }
                continuation.yield(.done)
            default:
                break
            }
        }

        if let choices = object["choices"] as? [[String: Any]],
           let delta = choices.first?["delta"] as? [String: Any],
           let content = delta["content"] as? String {
            continuation.yield(.content(content))
        }
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            return
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = decodeErrorMessage(from: data) ?? HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            throw APIClientError.httpStatus(httpResponse.statusCode, message)
        }
    }

    private func decodeErrorMessage(from data: Data) -> String? {
        guard !data.isEmpty else {
            return nil
        }

        if let errorResponse = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
            return errorResponse.message ?? errorResponse.error
        }

        return String(data: data, encoding: .utf8)
    }

    private func buildURL(path: String, queryItems: [URLQueryItem] = []) -> URL {
        let trimmedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        var components = URLComponents(url: baseURL.appendingPathComponent(trimmedPath), resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        return components.url!
    }

    private static func defaultBaseURL() -> URL {
        if let rawValue = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           let url = URL(string: rawValue) {
            return url
        }

        return URL(string: "https://api.polychat.app")!
    }

    private static func defaultUserAgent() -> String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        return "Polychat/\(version) CFNetwork Darwin"
    }
}

private struct EmptyResponse: Decodable {}

private struct APIErrorResponse: Decodable {
    let error: String?
    let message: String?
}

enum APIClientError: LocalizedError {
    case httpStatus(Int, String)
    case streaming(String)

    var errorDescription: String? {
        switch self {
        case .httpStatus(let status, let message):
            return "API returned \(status): \(message)"
        case .streaming(let message):
            return message
        }
    }
}

enum ChatStreamEvent {
    case content(String)
    case reasoning(String)
    case state(String)
    case metadata(messageId: String)
    case done
}

private extension Data {
    mutating func appendMultipartField(name: String, value: String, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        append("\(value)\r\n".data(using: .utf8)!)
    }

    mutating func appendMultipartFile(
        name: String,
        fileName: String,
        mimeType: String,
        data: Data,
        boundary: String
    ) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append(
            "Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(fileName)\"\r\n"
                .data(using: .utf8)!
        )
        append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        append(data)
        append("\r\n".data(using: .utf8)!)
    }
}
