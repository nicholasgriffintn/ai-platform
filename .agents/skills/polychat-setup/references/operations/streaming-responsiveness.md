# Streaming responsiveness

Long responses must keep stop, approval, question and terminal state usable. Treat the database message and exact-run snapshot as authoritative; a live preview is transport state, not a replacement retention format.

## Reproduce the workload

From the repository root, run:

```sh
pnpm --filter @assistant/api test src/lib/chat/streaming/__test__/tool-result-preview.test.ts src/repositories/__test__/MessageRepository.test.ts
pnpm --filter @assistant/app test src/lib/chat/__test__/stream-progress-coalescer.test.ts
pnpm test:mobile
```

The focused fixtures cover 10,000 text deltas, tool-result previews near the event limit, exact-cursor history paging and the native presentation boundary. The 5 September 2026 Apple Silicon baseline recorded:

| Measurement                                            |    Before |   After |
| ------------------------------------------------------ | --------: | ------: |
| iPhone presentation updates for one 10,000-delta burst |    10,000 |       1 |
| Web presentation updates for one 10,000-delta burst    |         1 |       1 |
| Consecutive progress events before a main-thread yield | Unbounded |      64 |
| Live bytes for one 8 MiB tool result                   | 8,388,723 |  33,072 |
| Initial JSON bytes for the 2,000-message transcript    | 8,293,891 | 414,751 |
| Initial message rows                                   |     2,000 |     100 |

The iPhone 16 simulator exercised the same 10,000-delta coalescing invariant in 0.002 seconds and produced one presentation update. The complete native suite passed 102 unit/presentation tests and six UI tests. Timing is diagnostic rather than a release threshold; retained bytes and update counts are the stable assertions.

## Enforced bounds

- Reject an unterminated or completed inbound stream event above 4 MiB on web and iPhone. Recover from the exact stored run; never turn the parse failure into a completed transcript.
- Limit a live tool-result event to 64 KiB and its content preview to 32 KiB. Persist the full tool message before emitting the preview, retaining its message ID and interaction metadata for recovery.
- Coalesce supersedable text once per display interval and yield after 64 consecutive progress events. Flush before tool, interaction, metadata, error and terminal events.
- Load 100 newest visible messages initially and request older pages by the exact oldest message ID. Deduplicate page overlap and preserve ascending transcript order.
- Render at most 40 KiB of tool text, 100 JSON children per branch and 100 table rows until the user expands the complete stored value.

## Release checks

Run Instruments on the oldest supported physical iPhone with a production build and exercise stop, approval and question controls during the fixture. Confirm VoiceOver reaches the load-earlier and expansion controls, expansion does not trigger memory termination, and background/foreground recovery restores the exact terminal run. Repeat in a production browser profile with the Performance and Memory panels; Chrome DevTools tracing is not available in the current automated workspace.
