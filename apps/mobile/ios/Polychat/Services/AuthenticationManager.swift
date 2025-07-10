import Foundation
import Combine

class AuthenticationManager: NSObject, ObservableObject {
    @Published var isAuthenticated: Bool = true // Always authenticated for beta
    
    private var apiClient: APIClient?
    
    private var apiKey: String {
        Bundle.main.object(forInfoDictionaryKey: "APIKey") as? String ?? ""
    }
    
    func configure(apiClient: APIClient) {
        self.apiClient = apiClient
        apiClient.setAPIKey(apiKey)
        self.isAuthenticated = true
    }
    
    func getAPIKey() -> String {
        return apiKey
    }
    
    func login() {
        // No-op for beta - always authenticated
        self.isAuthenticated = true
    }
    
    func logout() {
        // No-op for beta - always authenticated
        self.isAuthenticated = true
    }
}
