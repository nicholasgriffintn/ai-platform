# Owner-scoped conversation leases

- **Change:** Stored conversation work uses renewable owner-scoped leases, and stale attempts cannot release a successor or persist through the guarded conversation manager.
- **Surfaces:** API coordination, web chat recovery and native iOS chat recovery.
- **Prerequisites:** Deploy the API with the `CONVERSATION_COORDINATOR` Durable Object binding and its `ConversationCoordinator` migration.
- **Risk if wrong:** A long task can overlap a successor, a stale release can clear the successor's lease, or unavailable coordination can permit concurrent history writes.
- **Commits:** Not yet committed.

## Verify

- [ ] Start a stored task that runs for more than five minutes. Confirm web and iOS continue to report its active operation and a second write is refused until it completes.
- [x] Terminate the execution owner, wait for lease expiry, and confirm a new operation can acquire the conversation.
- [x] Delay the old owner's final persistence and release until after takeover. Confirm neither changes the successor's status or stored conversation.
- [x] Remove or break the coordinator binding in a non-production environment. Confirm interactive writes return a temporary service error and opportunistic refreshes do not mutate history.
- [ ] Reopen the same conversation on web and iOS. Confirm both show the public operation status without exposing the owner token.

**Stop and report if:** A stale attempt persists after takeover, clears another owner, or any client response or log exposes an owner token.

## Additional automated service evidence — 8 September 2026

- The coordinator fetch-interface test acquires as owner-old, advances beyond the five-minute lease without renewal, acquires as owner-new and verifies the new operation remains running when the expired owner tries to release it. This simulates owner loss with an advanced clock; it does not kill a deployed Worker.
- These tests passed in the existing 66-test service batch; no additional run was started.

## Automated boundary evidence — 8 September 2026

- The coordinator client tests exercise absent, unreachable and malformed bindings: interactive work fails with 503 and opportunistic work is never invoked. The 44-test policy batch passed.

## Reviewed automated evidence — 8 September 2026

- The 76-test boundary batch combines the coordinator takeover test (expired release cannot clear its successor) with ConversationManager write fencing (lost ownership prevents persistence entirely). This is clock-controlled owner-loss injection, not termination of a deployed Worker.
