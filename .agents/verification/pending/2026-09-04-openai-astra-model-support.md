# OpenAI model guidance and GPT-6 Astra

- **Change:** Align the guided OpenAI model families with their documented reasoning defaults and parameter compatibility, add GPT-6 Astra to the catalogue, and support Astra HTTP features including async tool declarations, configuration updates, explicit prompt caching, cache-write metering, and long-context pricing.
- **Surfaces:** Chat, Work, API, web model selection, iOS model selection, billing
- **Prerequisites:** Deploy the shared schemas and API together. Configure an OpenAI key with GPT-6 Astra access; the model is rolling out gradually.
- **Risk if wrong:** Astra requests fail at the provider boundary, an unsupported parameter is sent, or cache and long-context usage is undercharged.

## Verify

- [ ] Open Chat and a Work project with an Astra-enabled OpenAI account. Confirm GPT-6 Astra appears with the OpenAI icon and can complete a streamed text-and-image turn in both scopes.
- [ ] Send `reasoning_effort: low` and `reasoning_effort: max` through the API. Confirm both succeed, and confirm `none` is not offered by either model selector.
- [ ] Send an Astra Responses request with an `async: true` function definition. Confirm the provider accepts it and Polychat preserves the call ID for a later `function_call_output` input item.
- [ ] Send a standard Astra request with `compaction: off`, `truncation: disabled`, and an ordered `configuration_update` in `input`. Confirm the updated effort applies; then confirm agent mode and automatic compaction reject the same item before provider execution.
- [ ] Send GPT-5.6 and Astra requests with `prompt_cache_options: { mode: "explicit", ttl: "30m" }` and a content breakpoint. Confirm the response reports cache writes, then repeat the stable prefix and confirm it reports cached input.
- [ ] Inspect the usage ledger for that pair. Confirm cache-write tokens are not also charged as uncached input, and repeat with more than 272,000 input tokens to confirm all token units use the long-context rates.
- [ ] Confirm an Astra request containing temperature, top-p, top-logprobs, or `message.output_text.logprobs` does not forward those unsupported fields.

**Stop and report if:** either scope substitutes another model, OpenAI rejects the request shape, or the ledger double-counts cached or cache-write tokens.
