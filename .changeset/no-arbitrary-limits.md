---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-ai-integrations": minor
"@assistant/api": minor
---

Long work is no longer thrown away by arbitrary limits.

- **Runs finish.** Hosted agents (Pi, OpenCode, Hermes, OpenAI Agents, Bedrock) are no longer stopped after 15 or 60 minutes, and native agents on Polychat Desktop are no longer cut off after 10 minutes. Stopping a run still stops it.
- **Slow providers and tools get to answer.** Model, OCR, guardrail and reranking requests no longer give up after 30–120 seconds, Composio actions after 20 seconds, Composio file transfers after 15 seconds, or MCP tool calls after 15 seconds. Connecting to an MCP server still times out, so a dead server cannot hold up a chat.
- **Delegates hand back everything.** A delegate's final answer reaches the parent conversation in full instead of its first 2,000 characters, and delegation goals and progress messages are no longer capped.
- **Longer messages from other agents.** A2A and MCP callers can send teammates messages over 8,000 characters, and hosted agents receive your whole message and the full instructions rather than their last 100,000 and 12,000 characters.
- **Drafts are not rejected for being a little long.** Decks, tables, mind maps, flashcards, quizzes, video overviews, notebook guides and memory maintenance no longer fail when a title or line runs past a character limit. Web search answers and memory maintenance are no longer cut short by a fixed output limit.
