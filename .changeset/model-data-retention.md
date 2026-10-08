---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-model-catalogue": minor
"@ngriffin_uk/polychat-component-models": minor
---

Record how long providers keep API prompts and replies. Model configs gain an optional `dataRetention` block with the documented maximum days, how zero retention is reached (`default`, `account_setting` or `on_request`) and the policy URL. OpenAI, Azure OpenAI, Anthropic, Gemini API, Groq, Mistral and Bedrock carry their published defaults, and the model picker's hover preview shows them with a link to the policy.
