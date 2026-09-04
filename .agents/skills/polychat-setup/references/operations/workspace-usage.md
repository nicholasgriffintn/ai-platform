# Review workspace spend

Open **Work → workspace → Governance → Workspace usage** as an owner or administrator. Choose a month in UTC and refresh to review credits and recorded provider cost by source, vendor, and project. Each person continues to pay from their own account; this screen does not create a shared balance, expose a personal allowance, or include work outside this workspace.

The API is `GET /workspaces/<workspaceId>/usage?period=2026-09`. Omit `period` for the current UTC month. Ordinary members receive 403 and non-members receive 404 before the ledger is queried.

Attribution uses the workspace and project recorded on the usage event. Archived or removed projects remain in historical totals and appear as **Project no longer listed** when their name is unavailable. Missing project attribution appears as **Unassigned workspace usage**. Zero events produce an empty-period state, not an invented allowance.

Usage arrives asynchronously and some vendor costs are estimated. BYOK provider usage contributes recorded cost while its chargeable credits may be zero. These figures describe recorded consumption; they are not a real-time budget enforcement boundary.
