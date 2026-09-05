# Acknowledged web approvals

- **Change:** Generic web approval cards wait for their host action to succeed, block duplicate clicks while submitting, recover after failure and defer to persisted resolution or expiry.
- **Surfaces:** Personal Chat and project Work conversations on web. Native iOS is unchanged by this goal.
- **Prerequisites:** Use an account and project with a tool that can request exact-operation approval.
- **Risk if wrong:** A failed decision can look accepted, a repeated click can send duplicates, or stale local state can conceal a decision made elsewhere.
- **Commits:** Not yet committed.

## Verify

- [ ] Open a generic approval in personal Chat, choose **Approve**, and confirm both actions disable with a submitting message until the request succeeds.
- [ ] Throttle or fail the approval request. Confirm the card shows an inline failure, does not claim the choice was accepted, and permits one retry.
- [ ] Double-click an approval action while the request is in flight. Confirm only one submission reaches the API.
- [ ] Resolve the same project approval from another web session, then refresh or refetch the first session. Confirm the persisted approved or rejected state replaces its local state.
- [ ] Open an expired approval payload. Confirm the card shows expiry and no approval action.
- [ ] Approve an exact tool operation and confirm only the stored interaction and approved tool name are submitted; reject it and confirm no approved tool name is granted.

**Stop and report if:** A card reports a choice before the server acknowledges it, retries execute a different operation, or an expired/resolved card remains actionable.
