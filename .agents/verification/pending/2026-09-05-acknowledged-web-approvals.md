# Acknowledged web approvals

- **Change:** Generic web approval cards wait for their host action to succeed, block duplicate clicks while submitting, recover after failure and defer to persisted resolution or expiry.
- **Surfaces:** Personal Chat and project Work conversations on web. Native iOS is unchanged by this goal.
- **Prerequisites:** Use an account and project with a tool that can request exact-operation approval.
- **Risk if wrong:** A failed decision can look accepted, a repeated click can send duplicates, or stale local state can conceal a decision made elsewhere.
- **Commits:** Not yet committed.

## Verify

- [x] Open a generic approval in personal Chat, choose **Approve**, and confirm both actions disable with a submitting message until the request succeeds.
- [x] Throttle or fail the approval request. Confirm the card shows an inline failure, does not claim the choice was accepted, and permits one retry.
- [x] Double-click an approval action while the request is in flight. Confirm only one submission reaches the API.
- [ ] Resolve the same project approval from another web session, then refresh or refetch the first session. Confirm the persisted approved or rejected state replaces its local state.
- [x] Open an expired approval payload. Confirm the card shows expiry and no approval action.
- [x] Approve an exact tool operation and confirm only the stored interaction and approved tool name are submitted; reject it and confirm no approved tool name is granted.

**Stop and report if:** A card reports a choice before the server acknowledges it, retries execute a different operation, or an expired/resolved card remains actionable.

## Automated evidence — 5 September 2026

`features/interactions.spec.ts` passed against the real local app/API and a deterministic provider tool call. Going offline exposed optimistic interaction metadata resolving the card before acknowledgement. The host now attaches that resolution only after successful submission; the fixed journey confirms an inline failure, enabled retry and disabled Approve/Reject controls with a submitting message until success. Exact project-tool authority and cross-session reconciliation remain open.

The 6 September rerun also double-clicks the retry and observes exactly one completion submission. A second journey confirmed and fixed premature question acknowledgement: answers remain editable after failure and sending disables controls until success. Both journeys passed.

## Automated approval boundary — 9 September 2026

- Six new rendered-component tests pass in 2.42 seconds (`/tmp/polychat-approval-authority-validation.log`). Past timestamps and explicit expiry remove actions; Approve submits the stored interaction and exact tool name, while Reject grants no approved tool. A refreshed authoritative rejection replaces an earlier local acknowledgement. The actual two-session project journey remains pending.
