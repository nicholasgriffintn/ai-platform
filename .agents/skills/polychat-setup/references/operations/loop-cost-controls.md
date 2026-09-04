# Operate usage and execution limits

Credits are the monthly allowance; vendor units are the underlying cost record. Read [the credit decision](../architecture/decisions/0041-usage-metering-and-credits.md) before changing accounting or admission.

## Allowances and admission

Use the current D1 plan rows and `/plans` for included credits. Missing or non-positive allowances refuse admission. Free and anonymous plans have no reserve; eligible paid plans resolve configured or default grace through `planSeed.ts`. There is no runtime allowance fallback or daily message-limit system.

Admission reserves a turn estimate once. Normal depletion refuses new turns, while an admitted turn continues subject to step budgets, cancellation, failures and the runaway guard. BYOK model turns skip model-cost admission; infrastructure and capability charges still apply. Do not present this as an exact hard spending cap.

## Locate execution bounds

| Work                 | Authority                                                                       |
| -------------------- | ------------------------------------------------------------------------------- |
| Chat and agent steps | `resolveTurnStepBudget`, mode budgets and the shared loop's finalisation limits |
| Goal continuation    | Goal policy, evidence/stall state and usage admission                           |
| Project tasks        | Dispatch identity, project concurrency, task/stage budgets and approvals        |
| Sandbox runs         | Runner steps, commands, timeout and quality gate                                |
| Realtime sessions    | Session limits, reservation and reconciliation                                  |
| History writes       | `ConversationCoordinator` lease and entry-point locking                         |

Do not add provider work without a model-independent bound and usage emission. Acquire/release the conversation lock per operation, not per token or tool step. Detached cancellation polling is bounded by the turn lifetime.

## Reconcile spend

Every model-producing path, including panel and ensemble calls, uses `recordModelTurnUsage`. Capability metering wraps registered providers; infrastructure metering aggregates per request. Missing rates record estimated zero cost and must be investigated rather than mistaken for free work.

Sandbox reservations settle from terminal duration reports. Realtime reservations settle through reconciliation. Inspect missing settlements and orphaned holds after Worker failures; idempotency prevents duplicate reports from charging twice, but does not prove a report arrived.

Nightly infrastructure reconciliation compares attributed spend with account totals. Without `CLOUDFLARE_ANALYTICS_API_TOKEN`, that task logs and skips. Workers AI neuron cost is account-level where per-request usage is unavailable.

## Review workspace spend

Open **Work → workspace → Governance → Workspace usage** as an owner or administrator. Choose a UTC month to inspect recorded credits and provider cost by source, vendor and project. The API is `GET /workspaces/<workspaceId>/usage?period=YYYY-MM`; ordinary members receive 403 and non-members 404.

Historical attribution survives project removal. Missing names appear as **Project no longer listed**, and missing project attribution as **Unassigned workspace usage**. Each runner still pays from their own account; this report exposes neither their personal allowance nor unrelated work. Async and estimated usage make it a reporting view, not realtime budget enforcement.
