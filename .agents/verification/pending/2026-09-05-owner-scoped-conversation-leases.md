# Owner-scoped conversation leases

- **Change:** Stored conversation work uses renewable owner-scoped leases, and stale attempts cannot release a successor or persist through the guarded conversation manager.
- **Surfaces:** API coordination, web chat recovery and native iOS chat recovery.
- **Prerequisites:** Deploy the API with the `CONVERSATION_COORDINATOR` Durable Object binding and its `ConversationCoordinator` migration.
- **Risk if wrong:** A long task can overlap a successor, a stale release can clear the successor's lease, or unavailable coordination can permit concurrent history writes.
- **Commits:** Not yet committed.

## Verify

- [ ] Start a stored task that runs for more than five minutes. Confirm web and iOS continue to report its active operation and a second write is refused until it completes.
- [ ] Terminate the execution owner, wait for lease expiry, and confirm a new operation can acquire the conversation.
- [ ] Delay the old owner's final persistence and release until after takeover. Confirm neither changes the successor's status or stored conversation.
- [ ] Remove or break the coordinator binding in a non-production environment. Confirm interactive writes return a temporary service error and opportunistic refreshes do not mutate history.
- [ ] Reopen the same conversation on web and iOS. Confirm both show the public operation status without exposing the owner token.

**Stop and report if:** A stale attempt persists after takeover, clears another owner, or any client response or log exposes an owner token.
