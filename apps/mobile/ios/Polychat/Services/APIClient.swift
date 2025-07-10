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
    
    func createChatCompletion(messages: [ChatMessage], modelId: String) async throws -> ChatCompletionResponse {
        let url = URL(string: "\(baseURL)/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        
        let requestBody = ChatCompletionRequest(messages: messages, model: modelId)
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
}
