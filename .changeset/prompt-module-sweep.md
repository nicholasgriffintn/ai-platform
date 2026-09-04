---
"@assistant/api": patch
---

`lib/prompts` is the chat system prompt and nothing else. The article, web-search, extract-content and drawing prompts move to the services whose routes they back.

The prompt no longer compacts itself on small-context models. ADR 0032 found that compact variants drop exactly the detail that prevents a broken result, and the same mechanism was still trimming the principles and metadata sections.
