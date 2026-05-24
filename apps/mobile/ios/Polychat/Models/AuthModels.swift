import Foundation
public struct AuthUser: Codable, Equatable {
    public let id: Int
    public let name: String?
    public let avatarUrl: String?
    public let email: String
    public let githubUsername: String?
    public let planId: String?

    enum CodingKeys: String, CodingKey {
        case id, name, email
        case avatarUrl = "avatar_url"
        case githubUsername = "github_username"
        case planId = "plan_id"
    }
}

public struct AuthStatusResponse: Codable {
    public let user: AuthUser?
}

public struct TokenResponse: Codable {
    public let token: String
    public let expiresIn: Int
    public let tokenType: String?

    enum CodingKeys: String, CodingKey {
        case token
        case expiresIn = "expires_in"
        case tokenType = "token_type"
    }
}

public struct MagicLinkRequest: Codable {
    public let email: String
    public let redirectUri: String

    enum CodingKeys: String, CodingKey {
        case email
        case redirectUri = "redirect_uri"
    }
}

public struct MagicLinkVerifyRequest: Codable {
    public let token: String
    public let nonce: String
}

public struct MobileAuthExchangeRequest: Codable {
    public let code: String
}

public struct AppleSignInRequest: Codable {
    public let identityToken: String
    public let nonce: String
    public let fullName: String?

    enum CodingKeys: String, CodingKey {
        case identityToken = "identity_token"
        case nonce
        case fullName = "full_name"
    }
}

public struct SuccessResponse: Codable {
    public let success: Bool
}
