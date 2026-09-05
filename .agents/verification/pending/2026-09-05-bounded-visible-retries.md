# Bounded visible retries

Status: Pending manual verification.

## Setup

- Apply local migration 0025 after migrations 0021–0024, then run the API with a stored personal conversation and a stored project-task conversation.
- Use mocked provider and connector endpoints. Do not call a live model or external account for failure injection.
- Test web at narrow and wide widths, then the native app on a supported iPhone with VoiceOver and Dynamic Type.

## Verify

- Return model HTTP 429 with `Retry-After`, HTTP 503, a network failure and a response-header timeout. Confirm each eligible call makes at most two provider requests, waits no more than 30 seconds, and both clients show model attempt 2 of 2 plus the run-wide retry count.
- Cause transient failures on three separate model steps. Confirm only the first two steps repeat and the third makes one provider request. Confirm gateway logs show one gateway attempt for every turn-owned attempt rather than an additional gateway retry.
- Stop the exact run and attempt from the other client during backoff. Confirm the persisted retry state clears, no next provider request starts, and both clients converge on the cancelling then terminal state.
- Return HTTP 400, 401, 403 and 409, plus model-policy and usage-limit errors. Confirm each is terminal after one request and retains an actionable category rather than appearing as a transient retry.
- Start streaming output and then break the stream. Confirm the API does not replay the model request or duplicate visible text or tool calls.
- Fail a non-idempotent connector write after invocation without a response. Confirm the tool says the outcome is unknown, asks the user to check the external system, and blocks an identical repeat.
- Return a definitive rate-limit rejection for a write, then fail an explicitly idempotent write after invocation. Confirm each permits only one identical repeat and a changed parameter set is treated as a new operation requiring its normal authority and approval checks.
- Reopen the conversation and switch devices while waiting and while attempting. Confirm web and iPhone recover the exact retry snapshot, ignore stale-attempt events, clear it at terminal state, and never expose raw provider bodies, credentials, tool arguments or private reasoning.
- Confirm model, account, region and retention selection and current personal or project authority are unchanged by retry handling.
