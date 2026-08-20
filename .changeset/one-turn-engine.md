---
"@assistant/api": minor
---

Run every chat turn through one engine. Streaming and buffered requests now differ only in the transport they hand to the agent loop, so the step budget, tool execution, persistence, usage limits and the goal contract are resolved in one place instead of three.

Streaming agent turns are now gated by the active goal, which the streaming path previously skipped. Ordinary chat gets the chat mode step budget rather than a single tool round. Memory is classified once per run rather than once per turn, and no longer suppresses goal continuation.
