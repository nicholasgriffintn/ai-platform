# Credit enforcement admits turns up front and never cuts one off mid-thought

- **Change:** Chat turns are now admitted against the credit balance once, at turn start, with the estimate reserved on the balance until real spend lands. The per-step check inside the agent loop is now a runaway guard only: an admitted turn keeps going through `reserve` and `exhausted` and stops gracefully only past `included + grace + max(25% of grace, 25 credits)`. Goals stop at `exhausted`, not at `reserve`. The `usage_limits` stream metadata gains an optional `credits` object. Everything ships dark: while a plan's `included_credits` is null, every turn is admitted and today's message-count behaviour is unchanged.
- **Surfaces:** API
- **Prerequisites:** the PR2 ledger migration (`0015_worried_zaladane`) applied; to see enforcement at all, set `included_credits` on a plan (leave `grace_credits` null to get the default of `max(10% of included, 50)`).
- **Risk if wrong:** the two failure directions are opposite. Too strict and paying users are refused turns they can afford, or a turn dies mid-answer — the exact thing this phase exists to prevent. Too loose and a runaway agent loop spends without bound. A leaked reservation (worker death between admission and settlement) quietly shrinks a user's headroom until the period resets.

## Verify

- [ ] With `included_credits` still null on your plan: chat behaves exactly as before this deploy — daily and pro message counts still gate, no `credits` object appears in the `usage_limits` stream event.
- [ ] Set `included_credits` to a small value (for example 1) on your plan, spend past it, and send another message. Expect the turn to be admitted and to finish while the balance is inside the grace reserve, and the `usage_limits` event to carry `credits.state: "reserve"`.
- [ ] Spend past included plus grace with overage off. Expect the next turn to be refused at the request boundary with a calm message about credits being spent — not an error mid-stream — and `credits.state: "exhausted"`.
- [ ] While a long agent turn is running, confirm it is not truncated at the reserve boundary: the answer completes, and spend past the ceiling appears in `usage_balance.overrun_credit_micros` rather than blocking anything.
- [ ] Force the runaway path (tiny `included_credits`, long multi-step agent turn): the turn ends with a final answer and a `usage_limit_reached` finish reason, not a dropped stream.
- [ ] After a settled turn, check `usage_balance.reserved_credit_micros` returns to its pre-turn value — a value that only ever grows means releases are being lost.
- [ ] Set `overage_enabled` on the balance row, spend past the reserve, and confirm turns are still admitted with `credits.state: "overage"` and spend accruing to `overage_credit_micros`.
- [ ] With a BYOK key stored for the model's provider, confirm turns neither reserve nor spend credits for model usage.
- [ ] Signed out, confirm anonymous daily message limits still refuse exactly as before.

**Stop and report if:** any admitted turn is cut off mid-stream for balance, or a user with credits remaining is refused a turn. Both invert the product promise this phase implements.

## Notes

Reservations live only on `usage_balance.reserved_credit_micros` and are released next to spend settlement and again when the stream closes, idempotently. A worker crash between admission and both releases leaks the reservation until the period resets; if headroom looks mysteriously small, compare `reserved_credit_micros` against in-flight turns.
