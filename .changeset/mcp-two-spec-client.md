---
"@assistant/api": minor
"@assistant/agent-worker": patch
"@ngriffin_uk/polychat-ai-integrations": minor
"@ngriffin_uk/polychat-schemas": patch
---

MCP connections now work with servers on the new stateless `2026-07-28` protocol as well as session-based servers. Polychat picks the right one for each server automatically, so there is nothing to change on existing connections. Signing in to an MCP server now identifies Polychat with a Client ID Metadata Document where the server accepts one, and checks that the sign-in response came from the expected issuer.
