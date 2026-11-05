---
"@assistant/api": patch
"@ngriffin_uk/polychat-library-tools": patch
---

Tools from connected MCP integrations now get the same intent check as other external actions, even when the integration says a tool only reads. A call that does not match what you asked for will ask you first, so you may see the occasional extra approval. A tool marked as both read-only and destructive now counts as destructive.
