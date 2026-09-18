---
"@ngriffin_uk/polychat-ai-integrations": minor
"@ngriffin_uk/polychat-library-composio": minor
"@assistant/api": patch
---

Move Composio and the connector provider abstraction out of the API. `library-composio` owns the configured toolkit catalogue, its schema, the session handle contract and the `composio:sync` script, and `ai-integrations` owns the connector provider registry, operation and approval policy, write-outcome classification, API-key executors, the Composio REST and trigger clients, and the Pashi contract, catalogue and client. The API keeps connection authority, approvals, the private file bridge, run lifecycle, persistence and the function tool surfaces, and consumes both packages through `ai-integrations`.
