# One contract for every way a message reaches Polychat

- **Change:** A `ChannelAdapter` contract replaces the SMS-shaped assumption that a message can only arrive one way. Slack and Telegram adapters implement it, each proving a request came from its own service before anything reaches a conversation. Channel bindings say where messages land: Slack can bind to a project or a person, Telegram to a person only. Migration `0039` adds `channel_binding`.
- **Surfaces:** API. Inbound SMS behaviour is unchanged.
- **Prerequisites:** Migration `0039`. No channel is connected automatically, and no webhook route is exposed for the new channels in this change.
- **Risk if wrong:** A forged request reaching a conversation, a Slack channel bound to a project by someone without admin rights, or a reply posted into the wrong channel.
- **Commits:** This branch.

## Verify

- [ ] Connect a Slack channel to a project as a workspace admin. Confirm it is accepted, and that the same attempt as an ordinary member is refused.
- [ ] Try to connect a Telegram chat to a project. Confirm it is refused, since Telegram is personal only.
- [ ] Connect the same external channel twice and confirm the second attempt is refused rather than creating a duplicate.
- [ ] Disconnect a binding and confirm it stops resolving.
- [ ] Replay a captured Slack request an hour later and confirm it is refused on its timestamp.
- [ ] Send a Slack request signed with the wrong secret and confirm it is refused.
- [ ] Confirm inbound SMS still works exactly as before.

**Stop and report if:** a request with a wrong or missing signature reaches a conversation, or a binding is created by someone who could not otherwise write to that project.
