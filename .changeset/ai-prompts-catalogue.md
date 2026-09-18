---
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
"@ngriffin_uk/polychat-ai-prompts": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-ai-functions": minor
"@ngriffin_uk/polychat-ai-agents": minor
"@assistant/api": patch
"@assistant/sandbox-worker": patch
---

Centralise every authored prompt in a catalogue and a retrieval package. `library-prompts-catalogue` holds all prompt text and fragments as data with a validating schema, variables and conditionals; `ai-prompts` retrieves entries by id, task or variant, renders `{{variable}}` templates, and composes the chat, meta-assistant, sandbox, memory, document, agent, sandbox-worker, provider and panel prompts. Hardcoded prompts are removed from `ai-providers` (image styles and guardrail policies), `ai-functions` (task system prompts), `ai-agents`, `schemas` (council member prompts, teammate and platform teammate briefs) and the API and sandbox worker services, which now source their text from the catalogue.
