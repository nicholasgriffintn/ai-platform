---
"@ngriffin_uk/polychat-schemas": minor
"@assistant/api": minor
---

Your teammates can now be reached by other agents over Agent2Agent. Each teammate has an agent card at `/a2a/teammates/<id>/.well-known/agent-card.json`, and any A2A client holding your Polychat API key can send it work, stream its progress, check on a task later or cancel it. The teammate works in its own conversation and still asks you in Polychat before anything that sends, spends or deletes.
