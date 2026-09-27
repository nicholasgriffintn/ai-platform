---
"@assistant/api": patch
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-component-models": patch
"@ngriffin_uk/polychat-component-shell": patch
---

Claim provider creation atomically to prevent duplicate training jobs and deployments. Preserve cancellation requests during submission, expose the cancelling state, and register jobs that finish immediately. Recheck model approval before creation and require reconciliation for interrupted provider requests.

Settle hosting intervals and replace training costs atomically, and preserve accrued costs when pausing, scaling or deleting a deployment. Apply migration 0055 before deploying the API.
