import Foundation

class APIClient: ObservableObject {
    static let shared = APIClient()
    private let baseURL = "https://api.polychat.app"
    private let session = URLSession.shared
    private var apiKey: String = ""
    
    private init() {}
    
    func setAPIKey(_ key: String) {
        self.apiKey = key
    }
    
    func createChatCompletion(messages: [ChatMessage], modelId: String, completionId: String? = nil, settings: ChatSettings? = nil) async throws -> ChatCompletionResponse {
        let url = URL(string: "\(baseURL)/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }

        let requestBody = ChatCompletionRequest(messages: messages, model: modelId, store: true, completionId: completionId, settings: settings)
        request.httpBody = try JSONEncoder().encode(requestBody)
        
        let (data, response) = try await session.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            guard httpResponse.statusCode == 200 else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw NSError(domain: "APIClient", code: httpResponse.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: "API returned \(httpResponse.statusCode): \(errorMessage)"
                ])
            }
        }
        
        guard !data.isEmpty else {
            throw NSError(domain: "APIClient", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Empty response from server"
            ])
        }
        
        return try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
    }
    
    func fetchModels() async throws -> ModelsResponse {
        let url = URL(string: "\(baseURL)/models")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await session.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            guard httpResponse.statusCode == 200 else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw NSError(domain: "APIClient", code: httpResponse.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: "API returned \(httpResponse.statusCode): \(errorMessage)"
                ])
            }
        }
        
        return try JSONDecoder().decode(ModelsResponse.self, from: data)
    }
    
    func generateTitle(conversationId: String, messages: [ChatMessage]) async throws -> TitleGenerationResponse {
        let url = URL(string: "\(baseURL)/chat/completions/\(conversationId)/generate-title")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        
        let requestBody = TitleGenerationRequest(messages: messages)
        request.httpBody = try JSONEncoder().encode(requestBody)
        
        let (data, response) = try await session.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            guard httpResponse.statusCode == 200 else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw NSError(domain: "APIClient", code: httpResponse.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: "API returned \(httpResponse.statusCode): \(errorMessage)"
                ])
            }
        }
        
        return try JSONDecoder().decode(TitleGenerationResponse.self, from: data)
    }
    
    func initialize() async throws {
    }

    // MARK: - Conversation Management

    func fetchConversations(limit: Int = 50, page: Int = 1, includeArchived: Bool = false) async throws -> ConversationListResponse {
        var urlComponents = URLComponents(string: "\(baseURL)/chat/completions")!
        urlComponents.queryItems = [
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "include_archived", value: String(includeArchived))
        ]

        var request = URLRequest(url: urlComponents.url!)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse {
            guard httpResponse.statusCode == 200 else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw NSError(domain: "APIClient", code: httpResponse.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: "API returned \(httpResponse.statusCode): \(errorMessage)"
                ])
            }
        }

        return try JSONDecoder().decode(ConversationListResponse.self, from: data)
    }

    func fetchConversation(id: String, refreshPending: Bool = false) async throws -> ConversationDetailResponse {
        var urlComponents = URLComponents(string: "\(baseURL)/chat/completions/\(id)")!
        if refreshPending {
            urlComponents.queryItems = [URLQueryItem(name: "refresh_pending", value: "true")]
        }

        var request = URLRequest(url: urlComponents.url!)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse {
            guard httpResponse.statusCode == 200 else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw NSError(domain: "APIClient", code: httpResponse.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: "API returned \(httpResponse.statusCode): \(errorMessage)"
                ])
            }
        }

        return try JSONDecoder().decode(ConversationDetailResponse.self, from: data)
    }

    func updateConversation(id: String, title: String) async throws {
        let url = URL(string: "\(baseURL)/chat/completions/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }

        let requestBody = UpdateConversationRequest(title: title)
        request.httpBody = try JSONEncoder().encode(requestBody)

        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse {
            guard httpResponse.statusCode == 200 else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw NSError(domain: "APIClient", code: httpResponse.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: "API returned \(httpResponse.statusCode): \(errorMessage)"
                ])
            }
        }
    }

    func deleteConversation(id: String) async throws {
        let url = URL(string: "\(baseURL)/chat/completions/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse {
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw NSError(domain: "APIClient", code: httpResponse.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: "API returned \(httpResponse.statusCode): \(errorMessage)"
                ])
            }
        }
    }
}
