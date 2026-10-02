# Verify Cloudflare Auto Router

- **Change:** Offer Cloudflare Auto Router as an optional model with session affinity and billing for the selected upstream model.
- **Surfaces:** API and model pickers on web, desktop and iOS.
- **Prerequisites:** Configure stored provider keys or unified billing, candidate access policies and spend limits on the existing `llm-assistant` AI Gateway. Set `ACCOUNT_ID`, `AI_GATEWAY_TOKEN` and `CLOUDFLARE_AUTO_ROUTER_ENABLED=true` only after operator review. No migration is required.
- **Risk if wrong:** Gateway configuration can reject requests or make unintended upstream models eligible. The integration pins seven priced candidates and rejects missing or unknown routing headers.

## Verify

- [ ] Select Cloudflare Auto Router and complete a text conversation, image question and tool-assisted turn.
- [ ] Confirm successive tool requests use the same account/conversation session ID and reuse the model within a turn.
- [ ] Compare recorded token usage, selected vendor/model and cost against the gateway logs, including cached input tokens.
- [ ] Confirm a personal upstream API key does not make gateway usage BYOK or exempt it from credits.
- [ ] Disable the flag and confirm Auto Router becomes unavailable while existing model choices continue working.
- [ ] Check gateway spend-limit or credential failures produce an actionable request error.

**Stop and report if:** routing headers are absent, usage is attributed to a different model, or billing differs from the selected model's catalogue rates.
