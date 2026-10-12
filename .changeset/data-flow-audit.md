---
"@assistant/api": minor
"@ngriffin_uk/polychat-library-policy": minor
---

Audit when a tool call carries conversation data outside its audience. A new `data.flow` Cedar action allows flows only within the same personal or project scope; connector, MCP and HTTP writes that leave Polychat are recorded with the provider, the conversation scope and which private stores were in context. Nothing is blocked yet.
