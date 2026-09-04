# Usage metering is one system from provider call to account balance

- **Change:** Vendor-unit events are the only cost record. Ordinary and agent turns, ensemble secondaries, and panel completions enter the same idempotent ledger; each event and its monthly balance increment commit in one D1 batch. Free and anonymous daily message counters remain only as a one-response abuse guard. The old paid, BYOK, function multiplier, reset-task, and tool `costPerCall` paths are removed. The shared credit snapshot is visible in web account/sidebar state and decodable by iOS.
- **Surfaces:** API, web, iOS
- **Prerequisites:** apply migration `0015_worried_zaladane` and deploy the API.
- **Risk if wrong:** hidden model calls may be absent, a replay may move credits twice, or a client may show stale/empty balance state. Credits remain accounting rather than enforcement, so a ledger fault must not cut off a turn.

## Verify

- [ ] Apply `0015_worried_zaladane` and confirm the four tables exist and no existing table changed except `plans` gaining four nullable columns.
- [x] Send one signed-in chat message on a priced model, then `GET /user/usage/events`. Expect at least an `input_tokens` and an `output_tokens` row for that turn, both with `estimated: false` and a non-zero `credit_micros`. _(Local release E2Es validate the public event schema for Free and Pro turns.)_
- [ ] On a Free account, confirm one completed top-level turn increments `daily_message_count` once even when the agent takes several model steps. On a Pro account, confirm the turn is not blocked by a daily counter and no legacy paid/BYOK/function counters move.
- [ ] Repeat on a model with prompt caching. Expect `cached_input_tokens` and `cache_write_5m_tokens` rows, and confirm the input quantity is not double counted — Anthropic reports cache reads on top of input, OpenAI reports them inside it.
- [ ] Store your own provider key for that model's provider, send another message, and confirm the new rows carry `byok: true`, a non-zero `cost_micros`, `credit_micros: 0`, and `billable: false`.
- [x] Send a message inside a Work project conversation and confirm the rows carry both `project_id` and that project's `workspace_id`. _(Local release E2E polls the signed-in ledger after the Work turn.)_
- [ ] Run a two-model ensemble and confirm a distinct event set exists for the secondary model. Run Council or Second Opinion twice and confirm every panel member completion plus the conclusion has its own stable `panel:<tool-call>:<index>` message scope without colliding with the second invocation.
- [x] `GET /user/usage/balance` and confirm `credits.used` moved by roughly the sum of the events, and that `period` and `resets_at` name the current month. _(Local release E2E validates a 27-row ledger against the exact 26-credit balance and current period.)_
- [ ] Redeliver one `usage_rollup` payload and confirm its events remain singletons and `usage_balance.spent_credit_micros` does not move. Force a D1 batch failure in a non-production environment and confirm neither the event nor its balance increment commits.
- [ ] In the web app, confirm a paid account shows the same monthly credits in Account and the Sidebar before sending a message. A configured allowance shows `used / allowance`; a zero or missing allowance shows `used` without `/ 0` or "Unlimited usage". A Free account still shows its daily allowance. Complete a streamed turn and confirm the balance refreshes without disabling the composer, then trigger an auth refresh and confirm the Sidebar does not fall back to first-message copy. Leave Account open across a monthly reset and confirm it moves to the new period without a reload.
- [ ] In iOS, complete a streamed turn whose `usage_limits` includes `credits` and confirm decoding succeeds without changing the existing daily-limit behaviour.
- [ ] Sanity-check the scale against the published rates: a short Haiku reply should be a small fraction of one credit, not tens of credits. A number three orders of magnitude out means the micro-USD to micro-credit conversion is wrong, not the token count.
- [x] Confirm `GET /user/usage/events` returns only your own rows when signed in as another account. _(Local release E2E provisions a second Pro account and receives an empty ledger.)_

**Stop and report if:** any usage row has `estimated: true` for a model the catalogue prices, or if `usage_balance.spent_credit_micros` does not equal the sum of that period's billable `credit_micros`. Either means the rate card or the rollup is wrong, and later phases will enforce against it.

## Notes

`included_credit_micros` and `grace_credit_micros` are seeded from the plan's `included_credits` and `grace_credits` columns. A plan with null values has no displayed denominator; configure those values before treating the allowance as customer-ready. Legacy counter columns remain in D1 for rolling compatibility but no active path writes them. Credit exhaustion still does not enforce admission or stop an in-flight turn.
