---
"@assistant/api": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-utility-server": minor
---

Generated images, video and audio now carry a machine-readable provenance mark that stays with the file when you download it. Content Credentials and other marks from the model provider are kept exactly as they arrived, and files without one get a signed Polychat mark that labels them as AI-generated.

To check a file, look up its SHA-256 at `GET /provenance/{fingerprint}`. Signing keys are published at `GET /provenance/keys`.
