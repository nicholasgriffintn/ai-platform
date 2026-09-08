# A conversation can be handed to a machine and taken back

- **Change:** a turn can be queued for a machine to pick up, surfaced and cancellable from mobile, and expired when nothing claims it.
- **Surfaces:** API handoff endpoints, iOS app, desktop machine client.
- **Prerequisites:** migration `0048_striped_kronos` adds the `handoff` table.
- **Risk if wrong:** a turn is claimed twice, runs after cancellation, or waits forever with no visible state.
- **Commits:** 40237dffd, 88eb57e37, f52893484, 1e253207b, 2ed89cf31.

## Verify

- [ ] Queue a handoff and confirm it appears as pending on the iOS app.
- [ ] Claim it from a machine and confirm the state changes for the person watching.
- [ ] Cancel a pending handoff from mobile and confirm the machine cannot then claim it.
- [ ] Let a handoff pass its expiry unclaimed and confirm it reports expired rather than staying pending.
- [ ] Attempt to claim the same handoff from two machines and confirm only one wins.

**Stop and report if:** a cancelled or expired handoff still runs, or two machines both claim one.
