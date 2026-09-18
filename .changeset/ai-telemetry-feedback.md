---
"@ngriffin_uk/polychat-ai-telemetry": minor
"@ngriffin_uk/polychat-schemas": patch
"@ngriffin_uk/polychat-component-conversation": patch
"@ngriffin_uk/polychat-library-client": patch
"@assistant/api": patch
---

Add user feedback capture to telemetry. `captureAiFeedback` fans thumbs feedback out to a new AI Gateway sink that patches the stored log (when the message has a log id) and to PostHog as a survey response linked to the chat run trace that produced the message. Provider generation events now use the chat run as `$ai_trace_id` (falling back to the conversation) so feedback and generations link in AI Observability. The chat feedback endpoint accepts a `message_id`, resolves the message, run id, log id and trace id on the backend, and attributes feedback to the latest assistant message when clients send only the conversation. The frontend sends the message id and always shows feedback prompts on assistant messages.
