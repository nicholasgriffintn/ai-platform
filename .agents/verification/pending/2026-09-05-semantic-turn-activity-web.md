# Consistent live turn activity on web

- **Change:** Personal Chat and project Work now present provider-neutral preparing, reasoning, response generation, parallel tool execution, waiting, failure, cancellation and reconnection states from the shared turn stream.
- **Surfaces:** Web and API chat streaming.
- **Prerequisites:** Deploy the API and web application from the same release.
- **Risk if wrong:** A live conversation can show a stale or misleading activity label, hide a required question or approval, or lose its active marker after navigation or reconnection.
- **Commits:** Not yet committed.

## Verify

- [ ] In personal Chat, run a turn that reasons, generates text and uses two tools; confirm each label follows the actual phase and parallel execution is represented without disrupting streamed text.
- [ ] In project Work, navigate to another conversation while a turn runs, return to it, and confirm the active marker and current activity are scoped to the original conversation.
- [ ] Trigger a question and an approval; confirm each uses the correct waiting label and remains marked for action after the stream ends.
- [ ] Stop a response, exercise a provider failure, and interrupt the network during a stored turn; confirm stopped, failed and reconnecting states do not imply successful completion and recovered messages remain correct.
- [ ] Repeat the checks with reduced motion enabled and confirm active work remains legible without animation.

**Stop and report if:** activity labels appear on the wrong conversation, contradict a tool or terminal result, or change final message content or cadence.
