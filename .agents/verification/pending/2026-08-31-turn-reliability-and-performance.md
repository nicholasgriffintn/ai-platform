# Turn reliability and database performance changed under the hood

- **Change:** Stream deltas are coalesced and syntax-highlight autodetection is gone. D1 writes are batched, the conversation list query is indexed, and reads and writes nothing needed were removed. A detached turn now honours cancellation and truncation, a provider that withholds response headers is cut off after a bound, conversation messages are replaced in one transaction, the thread lock is refused when the coordinator call fails, and the compaction trigger is capped.
- **Surfaces:** web, iOS, API
- **Prerequisites:** migration `0006_next_whirlwind` adds the conversation list index.
- **Risk if wrong:** none of this shows in a screenshot. It shows as a message that never finishes, a stop button that does nothing, a duplicated message, or a conversation list that got slower rather than faster.
- **Commits:** `593d91be` (#2125), `3328ce8f` (#2124), `d8668b10` (#2137), `73c3aab8` (#2128), `13fcaaca` (#2134), `2b5eebf9` (#2135), `2d1a116f` (#2136), `48cb6e8a` (#2170)

## Verify

- [ ] Send a long streaming response. Confirm text arrives smoothly, code blocks are highlighted where the language is known, and nothing is dropped or duplicated at the end.
- [ ] Paste a code block with no language marker. Confirm it renders plainly rather than breaking — autodetection is gone on purpose.
- [ ] Press stop mid-response on the web. Confirm the response stops, the partial message is kept, and reloading shows the same partial content rather than a fuller or emptier one.
- [x] Switch to a new conversation mid-response, then return. Confirm the conversation opens with the response data received so far and continues to completion if the turn is still streaming, with no missing or duplicate assistant message.
- [x] Close the tab or browser mid-response, then reopen the conversation. Confirm it opens with the response data received so far and continues to completion if the turn is still streaming, with no missing or duplicate assistant message.
- [ ] Do the same on iOS with the new build.
- [ ] Edit or regenerate a message in a long conversation. Confirm the replacement is atomic — no window where the conversation shows both versions or neither.
- [ ] Open the conversation list with your largest account and note the load time. It should be no slower than before, and ideally faster.
- [ ] Run a conversation long enough to trigger compaction. Confirm it compacts once, at a sensible point, and the thread stays coherent.
- [ ] Start two turns in the same thread at once. Confirm the second is refused with a clear message rather than interleaving.

**Stop and report if:** a stopped response keeps generating and billing, or a conversation shows a duplicated or missing assistant message after a reload.
