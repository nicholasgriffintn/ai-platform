# Review workspace spend without sharing personal balances

- **Change:** Show monthly workspace usage by source, vendor, and project in Governance. Keep billing on each runner's account.
- **Surfaces:** web and API. iOS has no workspace Governance screen; sandbox and training contribute through existing ledger attribution.
- **Prerequisites:** none; use a workspace with recorded usage events.
- **Risk if wrong:** cross-workspace spend leaks, totals are misleading, or unauthorised members see financial data.
- **Commits:** See the PR containing this item.

## Verify

- [x] As an owner/admin open Work → workspace → Governance. Workspace usage shows recorded credits and source/vendor/project breakdowns. Select a historical month, then return to the current month and refresh. _(Local release E2E covers the full Governance journey.)_
- [x] Choose a month with no usage. Expect an empty-period message and zero recorded spend, without a shared allowance or balance. _(Local release E2E checks the empty copy and absence of allowance/balance language.)_
- [x] Compare `GET /workspaces/<id>/usage?period=2026-09` for two workspaces with different events. Neither response includes the other's usage or personal-only events. _(Local release E2E validates exact project keys and lower workspace event counts than the account total.)_
- [x] Repeat the API request as an ordinary member and a non-member. Expect 403 and 404 respectively. _(Local release E2E validates both status codes.)_
- [ ] Remove an administrator who has loaded Governance, then refresh their page. Governance must not retain cached spend after access is removed.
- [x] Record a BYOK model event and an infrastructure event. Provider cost includes both; chargeable credits follow the existing ledger's BYOK rules. _(Local release E2E validates 160,000 cost micros while only the infrastructure row contributes two credits.)_

**Stop and report if:** another workspace's activity appears or the page describes a shared credit balance.
