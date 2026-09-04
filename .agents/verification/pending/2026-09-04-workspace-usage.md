# Review workspace spend without sharing personal balances

- **Change:** Show monthly workspace usage by source, vendor, and project in Governance. Keep billing on each runner's account.
- **Surfaces:** web and API. iOS has no workspace Governance screen; sandbox and training contribute through existing ledger attribution.
- **Prerequisites:** none; use a workspace with recorded usage events.
- **Risk if wrong:** cross-workspace spend leaks, totals are misleading, or unauthorised members see financial data.
- **Commits:** See the PR containing this item.

## Verify

- [ ] As an owner/admin open Work → workspace → Governance. Workspace usage shows recorded credits and source/vendor/project breakdowns. Select a historical month, then return to the current month and refresh.
- [ ] Choose a month with no usage. Expect an empty-period message and zero recorded spend, without a shared allowance or balance.
- [ ] Compare `GET /workspaces/<id>/usage?period=2026-09` for two workspaces with different events. Neither response includes the other's usage or personal-only events.
- [ ] Repeat the API request as an ordinary member and a non-member. Expect 403 and 404 respectively. Governance must not retain cached spend after access is removed and the page refreshes.
- [ ] Record a BYOK model event and an infrastructure event. Provider cost includes both; chargeable credits follow the existing ledger's BYOK rules.

**Stop and report if:** another workspace's activity appears or the page describes a shared credit balance.
