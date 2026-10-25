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

public struct AuthUserSettings: Codable, Equatable {
    public let defaultModelTier: String?
    public let defaultModelId: String?
    public let defaultComputeSite: String?

    enum CodingKeys: String, CodingKey {
        case defaultModelTier = "default_model_tier"
        case defaultModelId = "default_model_id"
        case defaultComputeSite = "default_compute_site"
    }
}

public struct AuthStatusResponse: Codable {
    public let user: AuthUser?
    public let userSettings: AuthUserSettings?

    enum CodingKeys: String, CodingKey {
        case user
        case userSettings = "userSettings"
    }
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
}

public struct NativeAuthExchangeRequest: Codable {
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

enum DeviceCredentialScope: String, Codable {
    case full
    case discover
}

struct DeviceCodeRequest: Encodable {
    let clientName: String
    let scope: DeviceCredentialScope

    enum CodingKeys: String, CodingKey {
        case clientName = "client_name"
        case scope
    }
}

struct DeviceCode: Decodable, Equatable {
    let deviceCode: String
    let userCode: String
    let verificationUri: String
    let verificationUriComplete: String
    let expiresIn: Int
    let interval: Int

    enum CodingKeys: String, CodingKey {
        case deviceCode = "device_code"
        case userCode = "user_code"
        case verificationUri = "verification_uri"
        case verificationUriComplete = "verification_uri_complete"
        case expiresIn = "expires_in"
        case interval
    }
}

struct DeviceTokenRequest: Encodable {
    let grantType = "urn:ietf:params:oauth:grant-type:device_code"
    let deviceCode: String

    enum CodingKeys: String, CodingKey {
        case grantType = "grant_type"
        case deviceCode = "device_code"
    }
}

struct DeviceTokenResponse: Decodable {
    let accessToken: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
    }
}

struct DeviceAuthorisation: Decodable, Equatable {
    let userCode: String
    let clientName: String
    let scope: DeviceCredentialScope
    let expiresAt: String
}

struct DeviceDecisionRequest: Encodable {
    let decision: String
}

struct DeviceDecisionResponse: Decodable {
    let status: String
}
