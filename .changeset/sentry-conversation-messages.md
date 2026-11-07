---
"@ngriffin_uk/polychat-ai-telemetry": patch
---

Chat prompts and responses from people who allow it now appear in Sentry Conversations. Generation spans carry the conversation ID and Sentry's message format, including tool calls and results. Attachments are replaced with a placeholder, and long conversations keep their newest messages.
