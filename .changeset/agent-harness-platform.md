---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-sandbox": minor
"@ngriffin_uk/polychat-utility-core": patch
"@ngriffin_uk/polychat-ai-providers": patch
"@ngriffin_uk/polychat-component-models": patch
"@assistant/api": minor
"@assistant/sandbox-worker": minor
"@assistant/agent-worker": minor
---

Host agent harnesses on Polychat's own ports. The agent worker now runs the Pi and OpenCode harnesses and a Hermes container behind one RPC contract, with models served by the API's OpenAI-compatible `/agents/model` port, workspace tools gated by the permission mode, and every reply streamed into chat as it is generated. OpenAI Agents joins as a remote harness through the same `agent-harness` chat provider. The sandbox worker moves to Sandbox SDK 1.0 with app-owned `Workspace` and `Computer` classes, absorbs the computer worker, and keeps caches and browser profiles with `DirectoryBackup`.
