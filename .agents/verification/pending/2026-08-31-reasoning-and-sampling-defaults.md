# Reasoning effort, thinking, and sampling defaults changed

- **Change:** Claude 4.6 and newer use adaptive thinking and effort. Claude sampling and effort metadata was aligned across providers, sampling defaults are now derived rather than typed in, every flat reasoning-effort gateway path receives the setting, and Bedrock maps Anthropic thinking onto Converse requests.
- **Surfaces:** web, iOS, API
- **Prerequisites:** none beyond the release prerequisites.
- **Risk if wrong:** thinking is requested from a model that rejects it and the turn fails, or effort is dropped and answers quietly get worse.
- **Commits:** `4ee966aa` (#2145), `65a8b0f7` (#2172), `d184f360` (#2171), `a9ada2d2` (#2174), `32a2a700` (#2181)

## Verify

- [ ] Run a reasoning prompt on a Claude 4.6+ model. Confirm thinking appears, is attached to the right message, and the answer completes.
- [ ] Run the same prompt on an older Claude model. Confirm it still answers rather than erroring on an unsupported thinking parameter.
- [ ] Change reasoning effort in chat settings, ask something non-trivial, and confirm the setting visibly changes the response rather than being ignored.
- [ ] Run one reasoning-capable model through each gateway you use — direct provider, AI Gateway, OpenRouter, Bedrock. Confirm none rejects the request or silently drops thinking.
- [ ] Run a Bedrock Anthropic model with thinking on. Confirm the Converse request is accepted and thinking comes back.
- [ ] Where you can set temperature or top-p, confirm the values behave sensibly, and that a model which forbids custom sampling is not sent one.

**Stop and report if:** any provider returns a parameter validation error, or thinking output appears for a model that should not produce it.
