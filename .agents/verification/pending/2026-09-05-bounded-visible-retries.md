# Bounded visible retries

Status: Pending

## Setup

- Use mocked provider and connector endpoints. Do not call a live model or external account for failure injection.
- Test web at narrow and wide widths, then the native app on a supported iPhone with VoiceOver and Dynamic Type.

## Verify

- [ ] Return model HTTP 429 with `Retry-After`, HTTP 503, a network failure and a response-header timeout. Confirm each eligible call makes at most two provider requests, waits no more than 30 seconds, and both clients show model attempt 2 of 2 plus the run-wide retry count.
- [x] Cause transient failures on three separate model steps. Confirm only the first two steps repeat and the third makes one provider request. Confirm gateway logs show one gateway attempt for every turn-owned attempt rather than an additional gateway retry.
- [ ] Stop the exact run and attempt from the other client during backoff. Confirm the persisted retry state clears, no next provider request starts, and both clients converge on the cancelling then terminal state.
- [x] Return HTTP 400, 401, 403 and 409, plus model-policy and usage-limit errors. Confirm each is terminal after one request and retains an actionable category rather than appearing as a transient retry.
- [x] Start streaming output and then break the stream. Confirm the API does not replay the model request or duplicate visible text or tool calls.
- [x] Fail a non-idempotent connector write after invocation without a response. Confirm the tool says the outcome is unknown, asks the user to check the external system, and blocks an identical repeat.
- [x] Return a definitive rate-limit rejection for a write, then fail an explicitly idempotent write after invocation. Confirm each permits only one identical repeat and a changed parameter set is treated as a new operation requiring its normal authority and approval checks.
- [ ] Reopen the conversation and switch devices while waiting and while attempting. Confirm web and iPhone recover the exact retry snapshot, ignore stale-attempt events, clear it at terminal state, and never expose raw provider bodies, credentials, tool arguments or private reasoning.
- [ ] Confirm model, account, region and retention selection and current personal or project authority are unchanged by retry handling.

## Automated boundary evidence — 8 September 2026

- The provider-retry tests reject HTTP 400/401/403/409 and usage-limit failures after one call, preserving the original classified error. The 44-test policy batch passed.

## Boundary and source validation — 8 September 2026

- All 2,082 API tests passed across 288 files (`/tmp/polychat-api-verification-batch.log`). provider-stream.test.ts preserves partial text and marks a disconnected stream interrupted. Reviewed turn-transport.ts restricts retries to obtaining the initial provider response; stream consumption is outside that retry wrapper, preventing replay after visible output.

## Automated evidence — 9 September 2026

- The previously passing API suite covers connector operation failure normalisation, real dispatcher call-ledger behaviour and exact approved-operation replay. Unknown non-idempotent writes report “may have completed” and ask the person to check the provider; the ledger invokes the external boundary once and blocks an identical second call. Explicitly idempotent/definitively rate-limited writes permit one exact repeat, then stop. The ledger signature includes canonical parameters and every new call still enters the normal authority/approval dispatcher. No live external write was made.

- The 9 September retry batch passed all 12 tests in 950 ms. Three executed failing steps share a budget and make exactly 2, 2 and 1 calls; the gateway fetch test observes `cf-aig-max-attempts: 1` and exactly one outbound request. Four transient failure classes publish waiting/attempting snapshots, never exceed two calls or 30 seconds, then clear state. Client presentation and physical cross-device checks remain pending. Evidence: `/tmp/polychat-retry-budget-validation.log`.
