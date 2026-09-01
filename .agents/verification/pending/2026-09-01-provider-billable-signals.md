# Every billable provider signal now reaches the usage ledger

- **Change:** Chat turns now record more than plain tokens. Anthropic cache writes split into 5m/1h tiers and server tool use (web search, web fetch, code execution) becomes hosted-tool events; OpenAI Responses hosted tools (web search, file search, code interpreter, image generation) are counted from output items; Gemini records grounding, per-modality prompt tokens, and tool-use prompt tokens; xAI records live-search sources, Perplexity search queries and citation tokens, Cohere search units, DeepSeek cache hit/miss separation. OpenRouter requests now ask for usage accounting and the returned `usage.cost` replaces derived token pricing with one `usd_micros` event. Service tiers ride along as the rate tier. Flagship Anthropic, OpenAI, Gemini, and Grok catalogue entries gained hosted-tool prices.
- **Surfaces:** API
- **Prerequisites:** the usage ledger migration and deploy from the previous item.
- **Risk if wrong:** double billing (a signal counted in two units, or OpenRouter cost on top of token pricing) or silent undercounting. Both only show in the ledger, not in the product.

## Verify

- [ ] Send a message through an OpenRouter model, then `GET /user/usage/events`. Expect exactly one `usd_micros` row for that turn — no `input_tokens`/`output_tokens` rows beside it — with `cost_micros` matching the row's quantity and the token counts still visible inside `raw`.
- [ ] Send an Anthropic message that triggers web search. Expect a `web_search_requests` row with `source: hosted_tool`, `resource: web_search`, and a non-zero `cost_micros` at $10 per thousand searches.
- [ ] Send an Anthropic message with prompt caching under a 1h cache TTL. Expect `cache_write_1h_tokens` (not a summed `cache_write_5m_tokens`) priced at 2x the input rate.
- [ ] Send an OpenAI Responses message that uses web search. Expect a `web_search_requests` row counting the search calls; with code interpreter, expect one `requests` row with `resource: code_interpreter`, never one per call.
- [ ] Send a Gemini 2.5 message with search grounding. Expect one `grounded_requests` row at $35 per thousand.
- [ ] Send a Grok message with live search and a Perplexity Sonar message. Expect `search_sources` and `search_queries` rows respectively; Perplexity output tokens should include citation tokens exactly once.
- [ ] Send a DeepSeek message that hits the prompt cache. Expect `cached_input_tokens` for the hit and `input_tokens` equal to the miss count, summing to the reported prompt tokens.
- [ ] Confirm a hosted-tool row on a BYOK provider key still records cost but carries `credit_micros: 0` and `billable: false`.

**Stop and report if:** any turn produces both a `usd_micros` row and token rows, or a hosted-tool signal appears in two different units for the same turn. Either is double billing and must not reach enforcement phases.

## Notes

Units the catalogue does not price (Cohere search units, Anthropic web fetch, OpenRouter turns where the provider omits `cost`) record with `cost_micros: 0` and `estimated: true` by design. OpenRouter `is_byok` adds `cost_details.upstream_inference_cost` into the `usd_micros` quantity; whether the turn is billable is still decided by whether the user stored their own key.
