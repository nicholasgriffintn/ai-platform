# Responsive long conversations and large tool output

- **Change:** Chat now bounds live stream events and tool previews, coalesces text progress, pages long history, and keeps complete stored output behind explicit expansion.
- **Surfaces:** API streaming and conversation reads, web Chat, iPhone Chat.
- **Prerequisites:** Deploy the API, web app and iPhone build from the same revision. No migration or new binding is required.
- **Risk if wrong:** A large output may freeze stop or approval controls, an earlier page may be skipped or duplicated, or a parse failure may appear as a completed response.
- **Commits:** Uncommitted worktree change.

## Verify

- [ ] Open a conversation longer than 100 messages on web and iPhone. Confirm the initial window contains the newest messages in transcript order, **Load earlier messages** prepends the next page without jumping to the bottom, and repeated paging reaches the retained beginning without duplicates.
- [ ] Run a tool that persists more than 8 MiB of text. Confirm the live result says it is a bounded preview, stop and interaction controls remain usable, and the refreshed stored result offers **Show full output**.
- [ ] During a 10,000-delta response, request cancellation and resolve an approval or question when presented. Confirm the boundary appears promptly, pending text is not lost, and terminal state matches the authorised run after refresh.
- [ ] Interrupt the connection during a large or deliberately oversized event. Confirm web and iPhone recover the exact run snapshot and never display a false completed transcript.
- [ ] On the oldest supported physical iPhone, use Instruments and VoiceOver while loading earlier history and expanding output. Record peak memory, control latency, thermal state and any accessibility ordering issue.

**Stop and report if:** full stored output is unavailable, an earlier page loses or duplicates a message, control state arrives after expendable text, memory grows beyond the documented event/history bounds before explicit expansion, or a stream error fabricates completion.
