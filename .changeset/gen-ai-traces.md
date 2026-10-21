---
"@ngriffin_uk/polychat-ai-telemetry": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-utility-core": minor
"@assistant/api": minor
---

Polychat can now send traces to any OpenTelemetry backend. Each run becomes an agent span, with a span for every model call beneath it, using the standard gen_ai names for the model, provider, token usage and finish reason. Point the API at a collector and the traces appear next to the rest of your observability, with no prompt or reply text included.
