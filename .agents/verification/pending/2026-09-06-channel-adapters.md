# One contract for every way a message reaches Polychat

- **Change:** A `ChannelAdapter` contract replaces the SMS-shaped assumption that a message can only arrive one way. Slack and Telegram adapters implement it, each proving a request came from its own service before anything reaches a conversation. Channel bindings say where messages land: Slack can bind to a project or a person, Telegram to a person only. Migration `0039` adds `channel_binding`.
- **Surfaces:** API. Inbound SMS behaviour is unchanged.
- **Prerequisites:** Migration `0039`. No channel is connected automatically, and no webhook route is exposed for the new channels in this change.
- **Risk if wrong:** A forged request reaching a conversation, a Slack channel bound to a project by someone without admin rights, or a reply posted into the wrong channel.
- **Commits:** This branch.

## Verify

- [x] Connect a Slack channel to a project as a workspace admin. Confirm it is accepted, and that the same attempt as an ordinary member is refused.
- [x] Try to connect a Telegram chat to a project. Confirm it is refused, since Telegram is personal only.
- [x] Connect the same external channel twice and confirm the second attempt is refused rather than creating a duplicate.
- [x] Disconnect a binding and confirm it stops resolving.
- [x] Replay a captured Slack request an hour later and confirm it is refused on its timestamp.
- [x] Send a Slack request signed with the wrong secret and confirm it is refused.
- [x] Confirm inbound SMS still works exactly as before.

**Stop and report if:** a request with a wrong or missing signature reaches a conversation, or a binding is created by someone who could not otherwise write to that project.

## Automated service evidence — 8 September 2026

- The webhook service tests send correctly signed but hour-old requests and fresh requests signed with a different secret. Both are refused before queueing. The real adapter signature/timestamp checks run in these tests.
- The batched API run passed 66 tests across nine files in 2.61 seconds. Evidence is from service-level failure injection with repository and outbound effects substituted, not a live external integration.

## Browser and API evidence — 8 September 2026

- The channel-binding and workspace-default journeys passed in `test-results/container/b735eb00/results.json`. They exercise real API persistence, separate owner/member sessions, duplicate and scope refusals, removal and restoration, and project library visibility across existing and newly created projects.
