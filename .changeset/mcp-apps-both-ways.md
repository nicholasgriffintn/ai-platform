---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-integrations": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-component-content": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
---

MCP tools can now show their own interface in a conversation, and Polychat can be used as a tool from other assistants.

- **Apps inside the chat.** When a connected MCP integration ships an interface for a tool (the MCP Apps extension), Polychat renders it in the reply in a sandboxed frame: pickers, tables, small dashboards. The app can refresh its own data through read-only tools; anything that would change something still goes through the conversation so it can ask you first.
- **Polychat as an MCP server.** Point Claude, ChatGPT, Codex or any MCP client at the /mcp endpoint with a Polychat API key and it can list your teammates, message one, run a routine and read what is waiting on you. Approvals stay in Polychat.
