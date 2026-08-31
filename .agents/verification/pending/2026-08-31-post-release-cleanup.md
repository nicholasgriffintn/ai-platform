# Post-release cleanup: dead code, shared string helpers, tool catalogue imports

- **Change:** A cleanup pass over the whole release. Deleted code nothing referenced, replaced eleven local title-case implementations with `titleCaseSlug` and `capitaliseFirst` from `utility-core`, collapsed three copies of the `isRecord` predicate into one, and pointed five metadata-only consumers at the light tool catalogue (`listFunctionToolDefinitions`) instead of the tool-execution barrel. Finished the conversation coordinator: the thread lock now covers every entry point that mutates a conversation's history, not only turns and compaction, and the unreachable instruction queue beside it was retired (ADR 0039). The Durable Object stub and JSON-POST boilerplate shared by the three coordinator clients moved into one module.
- **Surfaces:** API, web
- **Prerequisites:** none.
- **Risk if wrong:** the label changes are cosmetic but wide — a tool, provider, connector, or canvas field could read differently. The catalogue swap changes which list backs several tool-listing surfaces, though a test now asserts the two lists match. The coordinator work touches the lock that stops two turns writing to one conversation, which is the part of this pass worth real attention.
- **Commits:** this cleanup pass, on top of `1686ccfe`..`da78d8ac`.

## Verify

- [ ] Open the tools list in settings. Confirm every tool you expect is listed, with the same names and descriptions as before, and that Free versus Pro visibility is unchanged.
- [ ] Open a project's tool configuration. Confirm the tool list matches, and that configuring one still saves.
- [ ] Ask a chat something that triggers capability discovery. Confirm discovered tools are still offered and activate.
- [ ] Run a turn through the model router and confirm routing still picks a sensible model — the router summarises the tool catalogue and now reads it from a different list.
- [ ] Run a tool from the tools UI (the runnable-tool form). Confirm the form fields still render from the tool's schema and the run succeeds.
- [ ] Look at a rendered tool result and a sandbox event. Confirm the labels read as before, e.g. "Web Search", "Extract Text From Document".
- [ ] Open a connector approval prompt and a recipe trigger. Confirm the labels are unchanged.
- [ ] Run OCR on a document that contains images or tables and confirm the output still renders — the image and table placeholder rewriting now uses the shared `escapeRegExp`.
- [ ] Open a canvas experience and confirm field labels read as before.
- [ ] Send a message, and while it streams, send a second one in the same conversation from another tab. Confirm the second is refused with a conflict rather than interleaving, and that the conversation history stays coherent.
- [ ] While a response is still streaming, edit or regenerate an earlier message in that same conversation. Confirm you are told the conversation is busy rather than losing the message the turn was writing, and that retrying after it finishes works.
- [ ] Answer a task runner's questions and resolve a task tool approval in Work. Confirm both still record and resume the run.
- [ ] Approve a connector operation that resumes a conversation, and confirm the replayed tool result lands once.
- [ ] Generate something that runs asynchronously (an image or a video). Confirm the result still appears in the conversation once it completes, both while you are watching and when you come back later.
- [ ] Let a conversation trigger compaction while a turn is in flight. Confirm compaction waits or refuses rather than racing the turn.
- [ ] Stop a turn part-way, then immediately start another in the same thread. Confirm the lock was released and the new turn runs.
- [ ] Start a sandbox run and watch it through to completion, including its live event stream and an approval prompt if you use them.
- [ ] Start and end a realtime session. Confirm the proxy reservation is taken and released — a second session on the same account should still be limited as before.

**Stop and report if:** two turns interleave in one conversation, a thread stays locked after a turn ends, or a tool that used to appear in a list is missing.
