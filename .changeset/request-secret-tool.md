---
"@assistant/api": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-component-conversation": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-sandbox": minor
---

The assistant can now ask you for an API key, token or webhook secret without it entering the conversation. A private input card shows what the secret is for and where it will be sent; the value is stored encrypted and the assistant only receives a reference that works once, in that conversation, for 24 hours. Pass that reference to `call_api` with `auth: { secret_ref }` to send it as a header, and any echo of the secret in the response is redacted.
