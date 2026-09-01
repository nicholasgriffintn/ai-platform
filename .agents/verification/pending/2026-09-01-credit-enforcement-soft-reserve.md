# Credit enforcement admits turns up front and never cuts one off mid-thought

- **Change:** Chat turns are now admitted against the credit balance once, at turn start, with the estimate reserved on the balance until real spend lands. The per-step check inside the agent loop is now a runaway guard only: an admitted turn keeps going through `reserve` and `exhausted` and stops gracefully only past `included + grace + max(25% of grace, 25 credits)`. Goals stop at `exhausted`, not at `reserve`. Spend past the ceiling is routed to `overrun_credit_micros`, or to `overage_credit_micros` when the user opted in, inside the same transactional batch that records the event. The `usage_limits` stream metadata gains an optional `credits` object. Message counting is gone: every actor, signed in or anonymous, is admitted against a credit balance, and `usage_limits` now carries only `credits`.
- **Surfaces:** API
- **Prerequisites:** migrations through `0018_pretty_lockjaw` applied. Plans need no credit values: the built-in allowances are anonymous 15, free 150, pro 1500, enterprise 15000, with a reserve of `min(max(10% of included, 50), 50% of included)`.
- **Risk if wrong:** the two failure directions are opposite. Too strict and paying users are refused turns they can afford, or a turn dies mid-answer — the exact thing this phase exists to prevent. Too loose and a runaway agent loop spends without bound. A leaked reservation (worker death between admission and settlement) quietly shrinks a user's headroom until the period resets.

## Verify

- [ ] With `included_credits` still null on your plan, confirm the `usage_limits` stream event carries a `credits` object with a non-zero `included` drawn from the built-in allowance.
- [ ] Set `included_credits` to a small value (for example 1) on your plan, spend past it, and send another message. Expect the turn to be admitted and to finish while the balance is inside the grace reserve, and the `usage_limits` event to carry `credits.state: "reserve"`.
- [ ] Spend past included plus grace with overage off. Expect the next turn to be refused at the request boundary with a calm message about credits being spent — not an error mid-stream — and `credits.state: "exhausted"`.
- [ ] While a long agent turn is running, confirm it is not truncated at the reserve boundary: the answer completes, and spend past the ceiling appears in `usage_balance.overrun_credit_micros` rather than blocking anything.
- [ ] Force the runaway path (tiny `included_credits`, long multi-step agent turn): the turn ends with a final answer and a `usage_limit_reached` finish reason, not a dropped stream.
- [ ] After a settled turn, check `usage_balance.reserved_credit_micros` returns to its pre-turn value — a value that only ever grows means releases are being lost.
- [ ] Set `overage_enabled` on the balance row, spend past the reserve, and confirm turns are still admitted with `credits.state: "overage"` and spend accruing to `overage_credit_micros`.
- [ ] With a BYOK key stored for the model's provider, confirm turns neither reserve nor spend credits for model usage.
- [ ] Signed out, confirm the anonymous allowance is enforced: `usage_limits` carries credits, spend accumulates on `anonymous_user.spent_credit_micros`, and turns are refused once the reserve is spent.
- [ ] Mint a realtime session and confirm it still succeeds, returns `max_session_seconds`, and enqueues a scheduled `realtime_reconciliation` task — the task type was missing from the shared enum until this change.

**Stop and report if:** any admitted turn is cut off mid-stream for balance, or a user with credits remaining is refused a turn. Both invert the product promise this phase implements.

## Notes

Reservations live only on `usage_balance.reserved_credit_micros` and are released next to spend settlement and again when the stream closes, idempotently. A worker crash between admission and both releases leaks the reservation until the period resets; if headroom looks mysteriously small, compare `reserved_credit_micros` against in-flight turns.
