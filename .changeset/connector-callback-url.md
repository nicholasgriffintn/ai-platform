---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-integrations": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-component-account": minor
"@ngriffin_uk/polychat-component-shell": patch
"@assistant/api": minor
---

Clearer setup for plugins that connect with an API key.

- **Callback URL.** The connect dialog shows a callback URL you can copy. If the provider asks for a callback or redirect URL when you create the key, paste this one in.
- **One box per credential.** Plugins that need more than one value now ask for each separately. Podcast Index asks for its API key and API secret, and Audiobookshelf for its server address and API token, so there's no need to join them with a colon or bar yourself.
