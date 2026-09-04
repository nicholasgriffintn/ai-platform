# Compact JSON tool results automatically

- **Change:** Remove JSON formatting whitespace before chat provider calls, with no settings or saved policy.
- **Surfaces:** API; web Chat/Work and iOS inherit server behaviour.
- **Prerequisites:** None.
- **Risk if wrong:** Changed tool values or broken tool-call continuation.
- **Commits:** See PR #2241.

## Verify

- [ ] Run a chat turn that returns formatted JSON from a tool. Confirm the model receives compact JSON and completes the turn, while the stored tool result retains its original content.
- [ ] Confirm JSON string whitespace and tool-call identifiers remain intact, and malformed or mixed-media results remain unchanged.

**Stop and report if:** values, stored history, or tool-call continuation change.
