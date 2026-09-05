# Consistent live turn activity on iOS

- **Change:** iOS now parses and projects the shared provider-neutral turn lifecycle while retaining its existing tool messages, stream-failure classification and detached-turn recovery.
- **Surfaces:** iOS and API chat streaming.
- **Prerequisites:** Install an iOS build and deploy the API from the same release.
- **Risk if wrong:** The app can show a stale or misleading phase, lose a pending human action, or mishandle a response when the app backgrounds or the network changes.
- **Commits:** Not yet committed.

## Verify

- [ ] Run turns that reason, generate text, assemble tool input and execute two tools; confirm the visible phase follows the work and tool messages remain incremental and correctly ordered.
- [ ] Trigger a question, an approval and a tool failure; confirm the waiting reason and failure state are accurate and persisted tool-result presentation remains authoritative.
- [ ] Stop a response and confirm the app does not present cancellation as success or replace useful partial output with “No response”.
- [ ] Interrupt the network during a stored turn, then background and foreground the app; confirm it shows reconnecting state and restores the persisted assistant/tool messages through existing recovery.
- [ ] Connect to a newer server that emits an unknown activity kind and confirm the turn continues without an error.

**Stop and report if:** the activity label contradicts the terminal result, tool messages are duplicated or reordered, or foreground restoration loses the recovered response.
