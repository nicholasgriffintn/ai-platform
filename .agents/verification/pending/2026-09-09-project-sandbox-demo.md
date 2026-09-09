# Complete project sandbox work without silent truncation

- **Change:** Use Workers AI's declared model output capacity when no explicit limit is supplied. Grant the registered sandbox tool to coding projects. Exclude obsolete persisted chat settings from completion requests. Preserve visible answer blocks in non-streaming completions when models also return reasoning.
- **Surfaces:** Web, desktop, API and sandbox.
- **Prerequisites:** A connected repository and an available model provider.
- **Risk if wrong:** Responses stop before tool execution or coding projects cannot start sandbox work.

## Verify

- [ ] Send a project coding request with automatic output length and observe a sandbox tool call.
- [ ] Set an explicit output limit and confirm it is honoured within model capacity.
- [ ] Complete a sandbox review and inspect its proof and validation output.

**Stop and report if:** A sandbox completion contains empty content and no tool calls.

Automated evidence: 63 API tests passed, API typechecking passed, and the earlier request-settings regression suites passed 39 tests. Runtime evidence: web/desktop chat sync in both directions and project brief sync worked. The sandbox cloned the demo repository but its planning completion was empty with both tested models; the original attempts failed before planning completed.

The empty-response regression now fails before the response-formatting fix and passes afterwards: all 29 agent-loop tests pass, alongside API typechecking and scoped lint/format checks. Browser verification subsequently completed run `12ae1d98-bf9e-4b16-b962-6a540f527ba6` with `gpt-5.6-sol`: the repository cloned, planning completed, and the requested three-bullet summary was returned. No commit or pull request was created. The run proof exposed a separate read-only defect: story tracking changed `prd.json` and `progress.txt`, while the chat summary incorrectly claimed no files changed. Keep read-only story-tracker behaviour and summary accuracy as follow-up checks.
