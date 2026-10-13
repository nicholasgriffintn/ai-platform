---
"@ngriffin_uk/polychat-ai-agents": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
"@assistant/api": minor
---

Attached documents that would take more than three quarters of the model's context window are replaced with a digest instead of failing the message. Each 50,000-character part is summarised in parallel with the auxiliary model, an overview is built from those summaries, failed parts are named rather than dropped, and complete digests are cached per user by content hash.
