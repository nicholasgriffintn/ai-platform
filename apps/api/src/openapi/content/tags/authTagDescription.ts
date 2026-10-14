import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const authTagDescription = md`
# Authentication

Sign people in and authenticate API calls.

## Methods

- **GitHub OAuth** and **Sign in with Apple** for social sign-in.
- **Magic links** for passwordless email sign-in.
- **Passkeys (WebAuthn)**, listed and removed under \`/auth/webauthn/passkeys\`.
- **Device authorisation (RFC 8628)** for CLIs and other devices without a browser. Start with \`POST /auth/device/code\`, show the user code, and poll \`POST /auth/device/token\` until it returns an API key.
- **Native code exchange** for the desktop and iOS apps.
- **API keys** for server-to-server calls, created under Account.

## Bearer tokens

~~~http
Authorization: Bearer <jwt_or_api_key>
~~~

\`GET /auth/token\` mints a JWT for the signed-in session. \`GET /auth/me\` returns the current user.

## Rate limits

Every route is rate limited per caller: 100 requests a minute when authenticated and 10 a minute otherwise. Exceeding the limit returns \`429 Too Many Requests\`.
`;
