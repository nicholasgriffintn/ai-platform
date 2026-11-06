# Operate usage and execution limits

Credits are the monthly allowance; vendor units are the underlying cost record. Read [the credit decision](../architecture/decisions/0022-meter-vendor-units-and-settle-once.md) before changing accounting or admission.

## Allowances and admission

Use the current D1 plan rows and `/plans` for included credits. Missing or non-positive allowances refuse admission. Free and anonymous plans have no reserve; eligible paid plans resolve configured or default grace through `planSeed.ts`. There is no runtime allowance fallback or daily message-limit system.

Admission reserves a turn estimate once. Normal depletion refuses new turns, while an admitted turn continues subject to step budgets, cancellation, failures and the runaway guard. BYOK model turns skip model-cost admission; infrastructure and capability charges still apply. Do not present admission as an exact hard spending cap: the exact limit is the per-run cap below.

## Cap a run

`budget.credits` on a create request sets a run's cap, stored as `conversation_run.spend_cap_credit_micros`. Work tasks carry `runCapCreditMicros` and routines carry `runCreditCapMicros`, applied to each run they start. Capped runs need a stored conversation and a signed-in account. A cap below one step's estimate is refused before work starts.

Before each model step the loop compares ledger spend plus that step's estimate with the cap. If the step might not fit, the run moves to `awaiting_approval` through a platform-issued `request_approval`, offering a raised cap or stopping. Only the stored raise option raises the cap; any other choice ends the run without another model call. Capped runs write usage inline so the check reads a current ledger. Agent-mode runs also write inline to keep the live `response.run_meter` event current; other runs' meters can trail the usage queue.

The cap limits what the person pays. A step or tool that costs more than its estimate is absorbed: `reconcileRunCharge` writes a compensating `run_cap_absorbed` event so charged credits never exceed the cap, while vendor cost stays recorded. Absorbed spend is real platform cost, so investigate if it grows.

Tools with a known cost are checked before they run, in `tool-cost.ts`: `run_sandbox_task` at its timeout, and `create_image` and `create_music` when the call names a model with a rate. If a batch might not fit, none of it runs, each call is answered as skipped, and the run pauses. Every other tool has no cost until it finishes, so it is counted afterwards and any overrun is absorbed: `create_video`, `create_speech`, web search, research, connectors and tools that call a model. Sandbox duration reaches the ledger from the runner's report, which can land after the next step's check.

A capped run gives a delegate a budget from what is left of its cap, and that budget is the child run's own cap. A delegate stops at its budget instead of pausing, because raising it would spend outside the parent's cap. While a delegate is live the parent counts its full budget; once settled it counts actual spend. `conversation_run.delegation_id` links the two.

Usage with no run attribution, such as title generation and memory capture, sits outside the cap.

## Refund platform failures

A run that ends `interrupted`, or `failed` for a reason `isPlatformFailure` classifies as ours, is marked with `usage_refunded_at` and refunded through compensating `platform_failure_refund` events. Guardrail failures, cancellation and caller errors keep their charge.

The ledger stays write-once: compensating rows carry negative credits, zero cost and zero quantity, and mirror the original period, source and resource so reports net correctly. Each rollup re-checks charged runs, so events still in the queue when a run fails are refunded on arrival. `usage_balance` reverses spend and any overage or overrun it created. Overage already sent to Stripe stays synced and offsets later overage in that period; a refund with no later overage needs a manual credit.

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

## Use automatic generation settings

Leave optional output-token and sampling settings unset unless the caller explicitly supplies an override. Do not add feature-specific token ceilings, temperatures or shared response-length defaults. Providers that require an output limit use the model catalogue's declared maximum; explicit caller limits remain constrained by that maximum. See [ADR 0011](../architecture/decisions/0011-resolve-models-and-readiness-on-the-server.md).

Keep provider protocol requirements, context retrieval budgets and execution step bounds separate from generation overrides. A saved agent's temperature is nullable: create it with automatic sampling and clear an existing override with `temperature: null`.

Council members and their conclusion use the same automatic generation settings. If a member fails, try an unattempted member within the existing turn budget; count failed attempts and preserve the underlying error when nobody responds. Decode Workers AI's buffered chat-completion choices as well as its legacy text responses.

## Reconcile spend

Every model-producing path, including panel and ensemble calls, uses `recordModelTurnUsage`. Capability metering wraps registered providers; infrastructure metering aggregates per request and writes the ledger inline after the response, bypassing task workflows. Missing rates record estimated zero cost and must be investigated rather than mistaken for free work.

For stored chat runs, use these definitions:

- **Reservation:** an admission estimate held against available credits. It is not consumption or a charge.
- **Consumption:** idempotent ledger events carrying the stable run ID and exact attempt. Their vendor units and priced credits are the accounting record.
- **Settlement:** one compare-and-set transition that releases the reservation from the balance. The assistant-turn finaliser settles after usage is written or durably queued; cancellation, terminal failure and owner recovery release unfinished holds.

Charge adjustment is separate from settlement: settlement releases a reservation, while adjustment corrects consumption after a refund or a cap overrun.

Missing provider usage is `unknown`. Context-window estimates may explain request size but never become zero actual consumption. A settled reservation with no ledger event can mean the queued rollup is still processing; investigate if it persists. Events written before run attribution remain only in account and workspace totals.

Chat-run reservations expire after 24 hours. Every scheduled invocation releases up to 100 expired held reservations through the same idempotent settlement path, so duplicate completion, owner failure and cancellation cannot double-release the balance and abandoned holds are bounded. Sandbox reservations settle from terminal duration reports. Realtime reservations settle through reconciliation.

Nightly infrastructure reconciliation compares attributed spend with account totals. Without `CLOUDFLARE_ANALYTICS_API_TOKEN`, that task logs and skips. Workers AI neuron cost is account-level where per-request usage is unavailable.

## Review workspace spend

Open **Work → workspace → Governance → Workspace usage** as an owner or administrator. Choose a UTC month to inspect recorded credits and provider cost by source, vendor and project. The API is `GET /usage/summary?workspace_id=<workspaceId>&period=YYYY-MM`; ordinary members receive 403 and non-members 404.

Historical attribution survives project removal. Missing names appear as **Project no longer listed**, and missing project attribution as **Unassigned workspace usage**. Each runner still pays from their own account; this report exposes neither their personal allowance nor unrelated work. Async and estimated usage make it a reporting view, not realtime budget enforcement; use per-run caps for enforcement.

## Baseline run lifecycle signals

Before setting alerts, record a representative baseline by deployment version and task cohort. Count `chat_run_duplicate_command`, `chat_run_recovery`, `chat_run_ownership_loss`, `chat_run_approval_latency`, `chat_run_cancellation_latency` and `chat_run_uncertain_tool_outcome` in the existing Analytics Engine dataset. Compare success, interrupted and unknown classifications, and use latency values for approval and cancellation distributions. Do not set a target from an empty or pre-migration window.

Correlate signals with D1 by run or task ID. Check held chat-run reservations past `expires_at`, settled runs with no attributed ledger events after queue drain, repeated idempotency keys, and usage rows with a null run ID. The last group is expected for older data and non-chat workloads. Metrics deliberately omit prompts, message content, tool arguments, credentials and raw provider payloads.
