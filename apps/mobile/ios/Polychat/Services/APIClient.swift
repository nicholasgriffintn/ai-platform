import Foundation

final class APIClient: ObservableObject {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let userAgent: String
    private var authToken: String?

    init(
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
        provider: String? = nil,
        completionId: String? = nil,
        settings: ChatSettings? = nil
    ) async throws -> ChatCompletionResponse {
        let requestBody = ChatCompletionRequest(
            messages: messages,
            model: modelId,
            provider: provider,
            store: true,
            completionId: completionId,
            settings: settings
        )

        return try await send(path: "/chat/completions", method: "POST", body: requestBody)
    }

    func streamChatCompletion(
        messages: [ChatMessage],
        modelId: String?,
        provider: String? = nil,
        completionId: String? = nil,
        settings: ChatSettings? = nil
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let requestBody = ChatCompletionRequest(
            messages: messages,
            model: modelId,
            provider: provider,
            store: true,
            completionId: completionId,
            settings: settings,
            stream: true
        )

        return AsyncThrowingStream { continuation in
            let task = Task.detached(priority: .userInitiated) {
                do {
                    try await self.stream(path: "/chat/completions", method: "POST", body: requestBody, continuation: continuation)
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
        convertToMarkdown: Bool = false,
        conversionOptions: MarkdownConversionOptions? = nil
    ) async throws -> UploadResponse {
        var formData = MultipartFormData()
        formData.appendFile(
            name: "file",
            fileName: fileName,
            mimeType: mimeType,
            data: data
        )
        formData.appendField(name: "file_type", value: fileType)
        if convertToMarkdown {
            formData.appendField(name: "convert_to_markdown", value: "true")
        }
        if let conversionOptions {
            let optionsData = try JSONEncoder().encode(conversionOptions)
            formData.appendField(
                name: "conversion_options",
                value: String(decoding: optionsData, as: UTF8.self)
            )
        }

        return try await send(
            path: "/uploads",
            method: "POST",
            bodyData: formData.finalizedBody(),
            contentType: formData.contentType
        )
    }

    func transcribeAudio(data: Data, fileName: String, mimeType: String) async throws -> TranscriptionResponse {
        var formData = MultipartFormData()
        formData.appendFile(
            name: "audio",
            fileName: fileName,
            mimeType: mimeType,
            data: data
        )

        return try await send(
            path: "/audio/transcribe",
            method: "POST",
            bodyData: formData.finalizedBody(),
            contentType: formData.contentType
        )
    }

    func generateSpeech(input: String, store: Bool = true) async throws -> SpeechGenerationResponse {
        let envelope: SpeechGenerationEnvelope = try await send(
            path: "/audio/speech",
            method: "POST",
            body: SpeechGenerationRequest(input: input, store: store)
        )

        return envelope.response
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

        return try decodeResponse(T.self, from: data)
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
            contentType: "application/json",
            additionalHeaders: [
                "Accept": "text/event-stream",
                "Accept-Encoding": "identity",
                "Cache-Control": "no-cache"
            ]
        )

        let (bytes, response) = try await session.bytes(for: request)
        let contentType = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type") ?? ""
        let isServerSentEventResponse = contentType.localizedCaseInsensitiveContains("text/event-stream")

        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            let errorData = try await collectResponseData(bytes)
            try validate(response: response, data: errorData)
        }

        guard isServerSentEventResponse else {
            let responseData = try await collectResponseData(bytes)
            let response = try decodeResponse(ChatCompletionResponse.self, from: responseData)
            let content = response.choices.first?.message.content.textValue ?? ""
            if !content.isEmpty {
                continuation.yield(.content(content))
            }
            continuation.yield(.done)
            continuation.finish()
            return
        }

        try await processServerSentEventStream(bytes, continuation: continuation)
        continuation.finish()
    }

    private func processServerSentEventStream(
        _ bytes: URLSession.AsyncBytes,
        continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) async throws {
        var dataLines: [String] = []

        for try await line in bytes.lines {
            if Task.isCancelled {
                return
            }

            let trimmedLine = line.trimmingCharacters(in: .whitespacesAndNewlines)

            if trimmedLine.isEmpty {
                if !dataLines.isEmpty {
                    try processServerSentEvent(dataLines.joined(separator: "\n"), continuation: continuation)
                    dataLines.removeAll(keepingCapacity: true)
                }
                continue
            }

            guard trimmedLine.hasPrefix("data:") else {
                continue
            }

            dataLines.append(String(trimmedLine.dropFirst(5)).trimmingCharacters(in: .whitespaces))
        }

        if !dataLines.isEmpty {
            try processServerSentEvent(dataLines.joined(separator: "\n"), continuation: continuation)
        }
    }

    private func collectResponseData(_ bytes: URLSession.AsyncBytes) async throws -> Data {
        var data = Data()
        for try await byte in bytes {
            data.append(byte)
        }
        return data
    }

    private func makeRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        bodyData: Data?,
        contentType: String?,
        additionalHeaders: [String: String] = [:]
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

        for (field, value) in additionalHeaders {
            request.setValue(value, forHTTPHeaderField: field)
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
                if let content = Self.extractContentDelta(from: object) {
                    continuation.yield(.content(content))
                }
            case "response.output_text.delta":
                if let content = Self.extractContentDelta(from: object) {
                    continuation.yield(.content(content))
                }
            case "thinking_delta":
                if let thinking = Self.extractReasoningDelta(from: object) {
                    continuation.yield(.reasoning(thinking))
                }
            case "signature_delta", "content_block_start", "content_block_stop", "message_start":
                break
            case "tool_use_start":
                continuation.yield(.state("tool_use_start"))
            case "tool_use_stop":
                continuation.yield(.state("tool_use_stop"))
            case "tool_response", "tool_response_start", "tool_response_end", "tool_use_delta":
                break
            case "state":
                if let state = object["state"] as? String {
                    continuation.yield(.state(state))
                }
            case "message_stop":
                continuation.yield(.done)
            case "message_delta":
                continuation.yield(.metadata(Self.extractStreamMetadata(from: object)))
                continuation.yield(.done)
            default:
                break
            }
            return
        }

        if let content = Self.extractContentDelta(from: object) {
            continuation.yield(.content(content))
            return
        }

        if let choices = object["choices"] as? [[String: Any]],
           let delta = choices.first?["delta"] as? [String: Any],
           let content = delta["content"] as? String {
            continuation.yield(.content(content))
        }
    }

    private static func extractContentDelta(from object: [String: Any]) -> String? {
        if let content = object["content"] as? String {
            return content
        }

        if let delta = object["delta"] as? String {
            return delta
        }

        if let response = object["response"] as? String {
            return response
        }

        if let text = object["text"] as? String {
            return text
        }

        if let delta = object["delta"] as? [String: Any] {
            if let text = delta["text"] as? String {
                return text
            }
            if let content = delta["content"] as? String {
                return content
            }
        }

        if let choices = object["choices"] as? [[String: Any]] {
            if let delta = choices.first?["delta"] as? [String: Any],
               let content = delta["content"] as? String {
                return content
            }
            if let message = choices.first?["message"] as? [String: Any],
               let content = message["content"] as? String {
                return content
            }
        }

        if let candidates = object["candidates"] as? [[String: Any]],
           let content = candidates.first?["content"] as? [String: Any],
           let parts = content["parts"] as? [[String: Any]] {
            let text = parts.compactMap { $0["text"] as? String }.joined()
            if !text.isEmpty {
                return text
            }
        }

        if let message = object["message"] as? [String: Any],
           let content = message["content"] as? String {
            return content
        }

        if let message = object["message"] as? [String: Any],
           let blocks = message["content"] as? [[String: Any]] {
            let text = blocks.compactMap { block -> String? in
                guard block["type"] as? String == "text" else { return nil }
                return block["text"] as? String
            }.joined()
            return text.isEmpty ? nil : text
        }

        return nil
    }

    private static func extractReasoningDelta(from object: [String: Any]) -> String? {
        if let thinking = object["thinking"] as? String {
            return thinking
        }

        if let delta = object["delta"] as? [String: Any] {
            if let thinking = delta["thinking"] as? String {
                return thinking
            }
            if let text = delta["text"] as? String {
                return text
            }
        }

        return nil
    }

    private static func extractFinalContent(from object: [String: Any]) -> String? {
        if let content = object["content"] as? String, !content.isEmpty {
            return content
        }

        if let message = object["message"] as? [String: Any],
           let content = message["content"] as? String,
           !content.isEmpty {
            return content
        }

        guard let parts = object["parts"] as? [[String: Any]] else {
            return nil
        }

        let textParts = parts.compactMap { part -> String? in
            guard part["type"] as? String == "text" else {
                return nil
            }
            return part["text"] as? String
        }

        let content = textParts.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        return content.isEmpty ? nil : content
    }

    private static func extractStreamMetadata(from object: [String: Any]) -> ChatStreamMetadata {
        let decoded: ChatStreamMetadata?
        if let data = try? JSONSerialization.data(withJSONObject: object) {
            decoded = try? JSONDecoder().decode(ChatStreamMetadata.self, from: data)
        } else {
            decoded = nil
        }

        return ChatStreamMetadata(
            messageId: decoded?.messageId ?? object["message_id"] as? String,
            content: decoded?.content ?? extractFinalContent(from: object),
            model: decoded?.model ?? object["model"] as? String,
            parts: decoded?.parts,
            reasoning: decoded?.reasoning,
            citations: decoded?.citations,
            data: decoded?.data,
            name: decoded?.name,
            status: decoded?.status,
            logId: decoded?.logId,
            created: decoded?.created
        )
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

    private func decodeResponse<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        let responseData = data.isEmpty ? Data("{}".utf8) : data
        let decoder = JSONDecoder()

        do {
            return try decoder.decode(type, from: responseData)
        } catch {
            if let envelope = try? decoder.decode(APIDataEnvelope<T>.self, from: responseData) {
                return envelope.data
            }
            throw error
        }
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

private struct APIDataEnvelope<T: Decodable>: Decodable {
    let data: T
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
    case metadata(ChatStreamMetadata)
    case done
}

struct ChatStreamMetadata: Decodable {
    let messageId: String?
    let content: String?
    let model: String?
    let parts: [ChatMessagePart]?
    let reasoning: ChatReasoning?
    let citations: [ChatCitation]?
    let data: ChatMessageData?
    let name: String?
    let status: String?
    let logId: String?
    let created: Double?

    enum CodingKeys: String, CodingKey {
        case content, model, parts, reasoning, citations, data, name, status, created
        case messageId = "message_id"
        case logId = "log_id"
    }
}
