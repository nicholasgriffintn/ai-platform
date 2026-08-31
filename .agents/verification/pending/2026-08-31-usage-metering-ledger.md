# Usage metering ledger records chat spend without changing behaviour

- **Change:** A metering ledger now records what work costs. Four D1 tables (`usage_event`, `usage_balance`, `usage_reservation`, `infra_cost_daily`), four `plans` columns, four `tasks.task_type` values, a rate card derived from the model catalogue, a `usage_rollup` queue handler, and three read-only routes under `/user/usage`. Chat turns emit priced usage events after the assistant message is stored.
- **Surfaces:** API
- **Prerequisites:** apply migration `0015_worried_zaladane` and deploy the API.
- **Risk if wrong:** this phase is write-only and enforces nothing, so the failure mode is silent — either no rows appear, or credits are recorded at the wrong scale. Both are invisible from the product until a later phase starts charging against them.

## Verify

- [ ] Apply `0015_worried_zaladane` and confirm the four tables exist and no existing table changed except `plans` gaining four nullable columns.
- [ ] Send one signed-in chat message on a priced model, then `GET /user/usage/events`. Expect at least an `input_tokens` and an `output_tokens` row for that turn, both with `estimated: false` and a non-zero `credit_micros`.
- [ ] Confirm the same message did not change your daily message count behaviour: the existing counters still govern, and nothing about the turn should look different to a user.
- [ ] Repeat on a model with prompt caching. Expect `cached_input_tokens` and `cache_write_5m_tokens` rows, and confirm the input quantity is not double counted — Anthropic reports cache reads on top of input, OpenAI reports them inside it.
- [ ] Store your own provider key for that model's provider, send another message, and confirm the new rows carry `byok: true`, a non-zero `cost_micros`, `credit_micros: 0`, and `billable: false`.
- [ ] Send a message inside a Work project conversation and confirm the rows carry both `project_id` and that project's `workspace_id`.
- [ ] `GET /user/usage/balance` and confirm `credits.used` moved by roughly the sum of the events, and that `period` and `resets_at` name the current month.
- [ ] Sanity-check the scale against the published rates: a short Haiku reply should be a small fraction of one credit, not tens of credits. A number three orders of magnitude out means the micro-USD to micro-credit conversion is wrong, not the token count.
- [ ] Confirm `GET /user/usage/events` returns only your own rows when signed in as another account.

**Stop and report if:** any usage row has `estimated: true` for a model the catalogue prices, or if `usage_balance.spent_credit_micros` does not equal the sum of that period's billable `credit_micros`. Either means the rate card or the rollup is wrong, and later phases will enforce against it.

## Notes

`included_credit_micros` and `grace_credit_micros` are seeded from the plan's new `included_credits` and `grace_credits` columns, which are null until someone sets them. Until then a balance reports zero included credits, which is expected at this phase and has no effect on what a user can do.
