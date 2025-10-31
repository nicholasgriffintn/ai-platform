# Authentication

Secure API access with multiple authentication methods including OAuth, magic links, passkeys, JWT tokens, and API keys.

## Overview

The API supports five authentication methods:

1. **GitHub OAuth** - Social login with GitHub
2. **Magic Links** - Passwordless email authentication
3. **Passkeys (WebAuthn)** - Biometric/device authentication
4. **JWT Tokens** - Token-based auth for applications
5. **API Keys** - Long-lived keys for server-to-server

## Authentication Methods

### GitHub OAuth

Social authentication using GitHub accounts.

#### Flow

```
1. Redirect user to /v1/auth/github
2. User authorizes on GitHub
3. GitHub redirects to /v1/auth/github/callback
4. Session cookie is set
5. User is redirected to your app
```

#### Usage

```html
<a href="https://api.polychat.app/v1/auth/github?redirect_uri=https://yourapp.com">
  Login with GitHub
</a>
```

**Parameters:**
- `redirect_uri` - Where to redirect after login (optional)
- `state` - CSRF protection token (optional)

**Response:**
Sets a session cookie and redirects to your app.

### Magic Links

Passwordless authentication via email.

#### Flow

```
1. POST /v1/auth/magic-link with email
2. User receives email with link
3. User clicks link
4. Session is created
5. User is redirected to app
```

#### Request Magic Link

```http
POST /v1/auth/magic-link
```

**Request:**
```json
{
  "email": "user@example.com",
  "redirect_uri": "https://yourapp.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Magic link sent to user@example.com"
}
```

### Passkeys (WebAuthn)

Biometric or device-based authentication using WebAuthn.

#### Registration Flow

```
1. POST /v1/auth/webauthn/register/begin
2. Client creates credential
3. POST /v1/auth/webauthn/register/complete
4. Passkey is registered
```

#### Authentication Flow

```
1. POST /v1/auth/webauthn/login/begin
2. Client gets assertion
3. POST /v1/auth/webauthn/login/complete
4. Session is created
```

### JWT Tokens

Generate JWT tokens for application authentication.

#### Generate Token

```http
POST /v1/auth/token
```

Requires an active session (from OAuth, magic link, or passkey).

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2024-02-15T10:30:00Z"
}
```

#### Using JWT Tokens

Include in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Keys

Long-lived keys for server-to-server authentication.

#### Create API Key

```http
POST /v1/user/api-keys
```

**Request:**
```json
{
  "name": "Production Server",
  "description": "API key for prod environment"
}
```

**Response:**
```json
{
  "id": "key_abc123",
  "key": "sk_live_abc123def456...",
  "name": "Production Server",
  "created_at": "2024-01-15T10:30:00Z"
}
```

⚠️ **Important:** Save the key immediately - it's only shown once!

#### List API Keys

```http
GET /v1/user/api-keys
```

#### Revoke API Key

```http
DELETE /v1/user/api-keys/{key_id}
```

#### Using API Keys

Include in the `Authorization` header:

```http
Authorization: Bearer sk_live_abc123def456...
```

## Session Management

### Get Current User

```http
GET /v1/auth/me
```

Returns information about the authenticated user.

**Response:**
```json
{
  "id": "user_xyz789",
  "email": "user@example.com",
  "name": "John Doe",
  "avatar": "https://github.com/username.png",
  "created_at": "2024-01-01T00:00:00Z",
  "plan": "free"
}
```

### Logout

```http
POST /v1/auth/logout
```

Invalidates the current session and clears cookies.

## Authorization Headers

All authenticated requests must include one of:

### Session Cookie (Browser)

```http
Cookie: session=abc123def456...
```

Automatically included by browsers.

### Bearer Token (Applications)

```http
Authorization: Bearer <token_or_api_key>
```

For JWT tokens or API keys.

## Security Best Practices

### For Web Applications

1. **Use OAuth or Magic Links** for user authentication
2. **Set httpOnly cookies** for session management
3. **Implement CSRF protection** with state parameters
4. **Use HTTPS** for all requests
5. **Validate redirect_uri** to prevent open redirects

### For Server Applications

1. **Use API keys** for server-to-server communication
2. **Rotate keys regularly** (every 90 days recommended)
3. **Store keys securely** (environment variables, secrets managers)
4. **Use separate keys** for different environments
5. **Monitor usage** and revoke suspicious keys

### For Mobile Applications

1. **Use OAuth or Passkeys** for user authentication
2. **Store tokens securely** (iOS Keychain, Android Keystore)
3. **Implement token refresh** before expiration
4. **Don't embed API keys** in mobile apps
5. **Use certificate pinning** for production

## Rate Limiting

Authentication endpoints have specific rate limits:

- **Magic Links**: 5 per hour per email
- **OAuth**: 10 per hour per IP
- **Token Generation**: 20 per hour per user
- **API Key Creation**: 10 per day per user

Exceeded limits return `429 Too Many Requests`.

## Error Responses

### 401 Unauthorized

```json
{
  "error": {
    "message": "Invalid or expired token",
    "type": "authentication_error",
    "code": "invalid_token"
  }
}
```

### 403 Forbidden

```json
{
  "error": {
    "message": "Insufficient permissions",
    "type": "authorization_error",
    "code": "insufficient_permissions"
  }
}
```

### 429 Too Many Requests

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded",
    "retry_after": 3600
  }
}
```

## Examples

### Web App Login

```javascript
// Redirect to GitHub OAuth
window.location.href = 'https://api.polychat.app/v1/auth/github?redirect_uri=' +
  encodeURIComponent('https://yourapp.com/auth/callback');

// After redirect, check authentication
const response = await fetch('https://api.polychat.app/v1/auth/me', {
  credentials: 'include' // Include cookies
});

if (response.ok) {
  const user = await response.json();
  console.log('Logged in as:', user.email);
}
```

### Server with API Key

```javascript
const POLYCHAT_API_KEY = process.env.POLYCHAT_API_KEY;

async function createCompletion(messages) {
  const response = await fetch('https://api.polychat.app/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${POLYCHAT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      messages
    })
  });

  return response.json();
}
```

### Mobile App with JWT

```swift
// After OAuth login, get JWT token
func getJWTToken() async throws -> String {
    let response = try await URLSession.shared.data(
        for: URLRequest(url: URL(string: "https://api.polychat.app/v1/auth/token")!)
    )

    let token = try JSONDecoder().decode(TokenResponse.self, from: response.data)

    // Store securely
    try KeychainHelper.save(token.token, forKey: "polychat_token")

    return token.token
}

// Use token for API requests
func makeRequest(token: String) async throws {
    var request = URLRequest(url: URL(string: "https://api.polychat.app/v1/chat/completions")!)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    // ... make request
}
```

## Migration Guide

### From Session to JWT

```javascript
// 1. Get current session (via cookie)
const session = await fetch('https://api.polychat.app/v1/auth/me', {
  credentials: 'include'
});

// 2. Generate JWT token
const tokenResponse = await fetch('https://api.polychat.app/v1/auth/token', {
  method: 'POST',
  credentials: 'include'
});

const { token } = await tokenResponse.json();

// 3. Use token for subsequent requests
fetch('https://api.polychat.app/v1/chat/completions', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Related Features

- [Chat Completions](./chat-completions.md) - Making authenticated API requests
- [Agents](./agents.md) - Creating user-specific agents
- [User Management](./user-management.md) - Managing user data and preferences
