# A Slack or Telegram message can now reach a conversation

- **Change:** `POST /webhooks/channels/:channel` is the inbound route for every channel adapter. It verifies the request against the deployment's signing secret, answers control requests such as Slack's `url_verification` handshake, resolves the `channel_binding` for the external id, and queues an `inbound_message` task for the binding's owner. The inbound task payload is now either a messaging provider, exactly as before, or a channel binding; a binding replies through its adapter and keeps everyone in the bound channel in one conversation.
- **Surfaces:** API. Inbound SMS behaviour is unchanged.
- **Prerequisites:** Migration `0039` and a binding created through `POST /channels/bindings`. Set `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_BOT_TOKEN`. Register the route as the Slack Events request URL and as the Telegram webhook, passing the same secret token to `setWebhook`.
- **Risk if wrong:** A forged request reaching a conversation, a reply posted into a channel nobody connected, or a Slack channel answering a person who has no account.
- **Commits:** This branch.

## Verify

- [ ] Point a real Slack app's Events request URL at the route and confirm the `url_verification` handshake is accepted.
- [ ] Post in a bound Slack channel and confirm the reply arrives in that channel, not in a DM.
- [x] Post in the same channel as a second person and confirm both messages continue one conversation.
- [x] Post in a Slack channel that has no binding and confirm nothing is queued and no reply appears.
- [ ] Register a Telegram webhook with a secret token, send a message, and confirm the reply arrives in that chat.
- [x] Disconnect a binding, send another message, and confirm the queued task is skipped rather than answered.
- [ ] Confirm inbound SMS still works exactly as before.

**Stop and report if:** a reply reaches a channel with no binding, a message answered before its signature was verified, or one person's Slack message opens a conversation under another account.

## Automated service evidence — 8 September 2026

- The webhook service returns unbound_channel without queueing; the inbound worker returns channel_unavailable for a disconnected binding without calling the turn runner or outbound adapter. Live Slack/Telegram delivery remains unverified.
- The batched API run passed 66 tests across nine files in 2.61 seconds. Evidence is from service-level failure injection with repository and outbound effects substituted, not a live external integration.

## Additional automated service evidence — 8 September 2026

- `inbound.test.ts` submits two differently identified senders through the inbound channel handler and verifies both use the same conversation ID. This is automated handler evidence with outbound messaging substituted; real Slack registration and delivery remain pending.
- These tests passed in the existing 66-test service batch; no additional run was started.
