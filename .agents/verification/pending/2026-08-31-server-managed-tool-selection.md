# The server now picks the tools for a turn

- **Change:** The web composer tool picker and the iOS tool list are gone. The API owns the baseline set of function tools for every turn, and a tool the model discovers mid-response is switched on for the rest of that response instead of asking the person to enable it. API callers can still send an explicit tool list.
- **Surfaces:** web, iOS, API
- **Prerequisites:** none beyond the release prerequisites.
- **Risk if wrong:** tools quietly stop being offered to the model, so capabilities look missing rather than broken. Or the opposite: everything is offered, and answers get worse and more expensive.
- **Commits:** `b1fc99f8` (#2144), `4f31a0f7`, `e50e9c04` (#2183). See ADR 0028 and ADR 0029.

## Verify

- [ ] Open a new chat on the web. Confirm the composer no longer offers a tool picker and nothing is left dangling where it was.
- [ ] Ask for something that needs a tool you would not have had switched on before — a web search, or the weather somewhere. Confirm the tool runs and its result renders.
- [ ] Ask for something that needs a capability you have never configured. Confirm the answer says what to set up rather than dead-ending or silently doing nothing.
- [ ] Repeat both prompts on iOS after installing the new build, and confirm chat settings no longer show a tool toggle list.
- [ ] Send a chat completion through the API with an explicit `enabled_tools` list. Confirm the model is offered exactly that list and no more.
- [ ] Run a turn that uses several tools in sequence. Confirm the ordering is sensible and no tool fires twice for one request.

**Stop and report if:** a tool that worked before this release is never offered, or a turn errors with a missing tool or provider registration. The provider registry and tool implementations were split apart in this release (#2183), and a bad registration surfaces exactly here.
