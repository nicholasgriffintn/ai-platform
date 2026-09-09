# Complete project sandbox work without silent truncation

- **Change:** Use Workers AI's declared model output capacity when no explicit limit is supplied. Grant the registered sandbox tool to coding projects. Exclude obsolete persisted chat settings from completion requests.
- **Surfaces:** Web, desktop, API and sandbox.
- **Prerequisites:** A connected repository and an available model provider.
- **Risk if wrong:** Responses stop before tool execution or coding projects cannot start sandbox work.

## Verify

- [ ] Send a project coding request with automatic output length and observe a sandbox tool call.
- [ ] Set an explicit output limit and confirm it is honoured within model capacity.
- [ ] Complete a sandbox review and inspect its proof and validation output.

**Stop and report if:** A sandbox completion contains empty content and no tool calls.

Automated evidence: 63 API tests passed, API typechecking passed, and the earlier request-settings regression suites passed 39 tests. Runtime evidence: web/desktop chat sync in both directions and project brief sync worked. The sandbox cloned the demo repository but its planning completion was empty with both tested models; a successful complete review remains unverified.
