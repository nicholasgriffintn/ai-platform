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
            let task = Task(priority: .userInitiated) {
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


    func fetchAssistantRecipes() async throws -> AssistantRecipesResponse {
        try await send(path: "/apps/recipes", method: "GET")
    }

    func installAssistantRecipe(id: String) async throws -> AssistantRecipeInstallResponse {
        try await send(
            path: "/apps/recipes/\(id)/install",
            method: "POST",
            body: AssistantRecipeInstallRequest(channel: "ios")
        )
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

        let streamClient = URLSessionStreamClient(configuration: session.configuration, request: request)
        var response: URLResponse?
        var responseData = Data()
        var isServerSentEventResponse = false
        var eventParser = ChatStreamEventChunkParser()

        for try await streamEvent in streamClient.stream() {
            switch streamEvent {
            case .response(let urlResponse):
                response = urlResponse
                let contentType = (urlResponse as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type") ?? ""
                let isSuccessfulHTTPResponse = (urlResponse as? HTTPURLResponse)
                    .map { (200...299).contains($0.statusCode) } ?? true
                isServerSentEventResponse = isSuccessfulHTTPResponse &&
                    contentType.localizedCaseInsensitiveContains("text/event-stream")
            case .data(let data):
                if isServerSentEventResponse {
                    yieldStreamEvents(from: try eventParser.append(data), continuation: continuation)
                } else {
                    responseData.append(data)
                }
            }
        }

        guard let response else {
            throw URLError(.badServerResponse)
        }

        try validate(response: response, data: responseData)

        if isServerSentEventResponse {
            yieldStreamEvents(from: try eventParser.finish(), continuation: continuation)
            continuation.finish()
        } else {
            let response = try decodeResponse(ChatCompletionResponse.self, from: responseData)
            let content = response.choices.first?.message.content.textValue ?? ""
            if !content.isEmpty {
                continuation.yield(.content(content))
            }
            continuation.yield(.done)
            continuation.finish()
        }
    }

    private func yieldStreamEvents(
        from events: [ChatStreamEvent],
        continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) {
        for event in events {
            continuation.yield(event)
        }
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

enum ChatStreamEvent: Equatable {
    case content(String)
    case reasoning(String)
    case state(String)
    case metadata(ChatStreamMetadata)
    case done
}

struct ChatStreamMetadata: Decodable, Equatable {
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
