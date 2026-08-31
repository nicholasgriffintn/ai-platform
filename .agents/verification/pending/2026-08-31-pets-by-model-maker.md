# Pets are assigned by model maker

- **Change:** Pet assignment moved from picking individual models to rules over model makers, with a rule dialog in the pets panel and a shared maker list in the schemas package.
- **Surfaces:** web, API
- **Prerequisites:** none beyond the release prerequisites.
- **Risk if wrong:** an assignment somebody set by hand is silently rewritten, or a model matches no maker and shows no companion.
- **Commits:** `d7bef641` (#2143)

## Verify

- [ ] Open Profile → Pets. Confirm your existing assignments still resolve to the companions you expect.
- [ ] Add a rule for a maker, save, and confirm a chat on one of that maker's models shows the assigned companion.
- [ ] Remove that rule and confirm the companion reverts rather than sticking.
- [ ] Chat on a model from a maker you have set no rule for. Confirm the fallback looks deliberate rather than empty.
- [ ] Check a model whose provider differs from its maker — an Anthropic model through Bedrock, say — and confirm it is attributed to the maker, not the gateway.

**Stop and report if:** a saved assignment disappeared, or a model resolves to a companion from the wrong maker.
