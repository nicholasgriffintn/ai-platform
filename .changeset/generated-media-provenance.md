---
"@assistant/api": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-utility-server": minor
---

Generated images, video and audio now carry a machine-readable provenance mark that stays with the file when you download it. Content Credentials and other marks from the model provider are kept exactly as they arrived, and files without one get a Polychat mark that labels them as AI-generated. Marks are signed on deployments that set `PROVENANCE_SIGNING_KEY`.

To check a file, look up its SHA-256 at `GET /provenance/{fingerprint}`. The result says how the file was handled, including files recorded without an embedded mark. Signing keys are published at `GET /provenance/keys`.
