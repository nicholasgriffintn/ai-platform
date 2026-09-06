# Complete council turns with automatic generation settings

- **Change:** Remove internal output-token and sampling overrides; decode buffered Workers AI chat responses and recover from a failed council opener. Allow saved agents to use automatic sampling.
- **Surfaces:** API model requests, web Chat council results and agent editor; iOS consumes the same API responses.
- **Prerequisites:** Run the updated API and web code. No migrations or new configuration.
- **Risk if wrong:** Providers reject missing required parameters, reasoning ends without an answer, or an agent keeps an unwanted sampling override.

## Verify

- [ ] Retry a council with GLM 4.7 Flash and observe visible member turns followed by a conclusion.
- [ ] Check a normal response and a structured response with automatic settings; confirm neither request contains a feature-specific output or sampling override.
- [ ] Run an Anthropic model with automatic settings and confirm the required output maximum comes from its catalogue entry.
- [ ] Create an agent without a temperature, then set an explicit value and clear it. Save and reopen the editor after each operation; confirm the final value remains automatic.
- [ ] Confirm a failed opening member permits another member to answer and a completely failed panel reports its underlying failure.

**Automated evidence:** Panel recovery, buffered response decoding, parameter handling and agent editor tests cover these boundaries with provider responses simulated.

**Stop and report if:** A council produces no visible member response, a provider rejects generation parameters, or clearing a temperature does not persist.
