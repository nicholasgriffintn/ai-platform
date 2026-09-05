# Lossless conversation compaction coverage

- **Change:** Compaction archives only fully represented messages and reports summarised, verbatim-fallback and retained message counts.
- **Surfaces:** API, web and native iOS chat.
- **Prerequisites:** Deploy compatible API and client builds; use a stored conversation with enough older content to exceed the summary-input limit.
- **Risk if wrong:** A later constraint or oversized message can disappear from active model context while the compaction marker incorrectly implies it was preserved.
- **Commits:** Not yet committed.

## Verify

- [ ] On web, compact a long stored conversation whose older candidate segment ends with a distinctive constraint. Confirm the compaction row reports compacted and retained counts, then ask a follow-up that depends on the retained constraint.
- [ ] Reopen the same conversation on iOS and confirm the compaction row shows the same coverage detail without exposing the hidden snapshot as an ordinary assistant message.
- [ ] Repeat with an individually oversized oldest candidate and confirm compaction leaves the conversation unchanged rather than showing a successful compaction marker.

**Stop and report if:** A retained constraint disappears, web and iOS disagree on coverage, or an oversized unrepresented message is archived.
