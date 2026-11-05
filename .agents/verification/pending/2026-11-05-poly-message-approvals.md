# Approve a Poly routine's next step by message

- **Change:** Poly routines send a one-time code on bound channels, and replying `APPROVE` or `REJECT` with it resumes the waiting call.
- **Surfaces:** API and web.
- **Prerequisites:** apply the message approval migration; a Telegram or Slack channel bound to Poly with a verified sender; a connected mail account; for SMS, a messaging provider whose allowed senders include the target number.
- **Risk if wrong:** an approval could fail to resume a routine, or a reply could reach the wrong run.
- **Commits:** branch `clanker/proactive-agent-5bfa51`.

## Verify

- [ ] In Discover, open Routines and turn on Inbox triage a few minutes ahead. The brief appears under From Poly and on the bound channel.
- [ ] When Poly asks to save a draft, reply `APPROVE <code>` on Telegram. The run continues, and the connector's own approval arrives as a second code.
- [ ] Reply with the same code again. Poly answers that it is not valid and nothing runs.
- [ ] Repeat on Slack and by SMS, then reply `REJECT <code>` once and confirm the run stops the action.
- [ ] From an unverified Slack user or number, reply with a live code. Nothing happens.
- [ ] Leave a code for over six hours, then reply. Poly answers that it is not valid and the action still waits in Polychat.

**Stop and report if:** a code works twice, works from another sender, or a reply reaches the model as a normal message.
