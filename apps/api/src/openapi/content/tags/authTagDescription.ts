import { md } from "~/utils/markdown.js";

export const authTagDescription = md`# Authentication

Secure API access with multiple authentication methods including OAuth, magic links, passkeys, JWT tokens, and API keys.

## Overview

The API supports five authentication methods:

1. **GitHub OAuth** - Social login with GitHub
2. **Magic Links** - Passwordless email authentication
3. **Passkeys (WebAuthn)** - Biometric/device authentication
4. **JWT Tokens** - Token-based auth for applications
5. **API Keys** - Long-lived keys for server-to-server

## Using Bearer Tokens

\`\`\`http
Authorization: Bearer <token_or_api_key>
\`\`\`

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

Exceeded limits return \`429 Too Many Requests\`.`;
