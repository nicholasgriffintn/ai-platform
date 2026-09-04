# Fast processing can be selected per conversation

- **Change:** Chat settings expose Automatic, Standard, and Fast processing for compatible OpenAI models. Fast shows its token-price multiplier, and changing models returns processing to Automatic.
- **Surfaces:** web, iOS, API
- **Prerequisites:** Use an OpenAI project that can run GPT-5.6 or GPT-6 Astra. Astra Fast cannot use EU data residency.
- **Risk if wrong:** A person may pay the Fast price without choosing it, send an unsupported tier, or believe a request used Fast when OpenAI downgraded it.
- **Commits:** pending

## Verify

- [ ] In Chat and Work on the web, select GPT-6 Astra, open Chat settings, and confirm Processing offers Automatic, Standard, and Fast with the 2× price and EU residency note.
- [ ] Select Fast, send a message, and confirm the request succeeds and its usage is charged from the provider-reported service tier.
- [ ] Return Processing to Automatic, send another message, and confirm no explicit `service_tier` is sent.
- [ ] Select Standard, send another message, and confirm the request uses `service_tier: default`.
- [ ] Change to a model without Fast support and confirm the Processing selector disappears and the previous choice is cleared.
- [ ] Repeat the Fast and Automatic checks in the iOS Chat settings sheet.
- [ ] With a GPT-6 Astra key bound to EU data residency, request Fast and confirm the provider refusal is surfaced as a single failed turn rather than silently reported as Fast.

**Stop and report if:** Processing appears on an unsupported model, a previous tier survives a model change, Automatic sends a tier, or usage is priced from the request rather than OpenAI's response.
