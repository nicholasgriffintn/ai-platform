---
"@ngriffin_uk/polychat-library-tools": minor
"@ngriffin_uk/polychat-library-skills-catalogue": minor
"@assistant/api": minor
---

Teammates now check what they are about to do before doing it, and skills are scanned before they go live.

- **Intent check on real effects.** Before a routine, channel reply, delegation or handoff sends a message, spends money, deletes something, handles a credential or exports data, a second check compares the call, where it lands and who started the run against what you asked for. A call that does not follow from the request, or reaches a recipient or system you never named, waits for your approval with the reason attached.
- **Connector and MCP calls say what they do.** Sending an email, posting to a channel, deleting a record or taking a payment through a connector or an MCP integration is classed by the operation, so sends and payments ask at every autonomy level and never earn a standing approval. Dry runs draft them instead of running them.
- **Skill scanning.** Promoting a draft skill or importing one from another scope scans it first. Instructions that try to override the assistant, hide text, act without telling you, move credentials or private data out, embed a secret or point at a private address keep the draft but block it from going live, with each problem named.
