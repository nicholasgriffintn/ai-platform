import Foundation

final class APIClient: ObservableObject {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private var authToken: String?

    private init(
        baseURL: URL = APIClient.defaultBaseURL(),
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.session = session
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
        var request = URLRequest(url: buildURL(path: path, queryItems: queryItems))
        request.httpMethod = method
        request.setValue("mobile", forHTTPHeaderField: "X-Platform")
        request.setValue("Polychat iOS", forHTTPHeaderField: "User-Agent")

        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }

        if let authToken {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = bodyData

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)

        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }

        return try JSONDecoder().decode(T.self, from: data)
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
}

private struct EmptyResponse: Decodable {}

private struct APIErrorResponse: Decodable {
    let error: String?
    let message: String?
}

enum APIClientError: LocalizedError {
    case httpStatus(Int, String)

    var errorDescription: String? {
        switch self {
        case .httpStatus(let status, let message):
            return "API returned \(status): \(message)"
        }
    }
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
