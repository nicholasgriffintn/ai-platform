# The thread follows a streaming response

- **Change:** The message list now pins itself to the bottom while a response streams. It re-pins when the conversation changes or the reader sends a message. Following is released by actual upward movement under a live gesture (wheel, touch, key, scrollbar drag), however small, and never by a gesture that does not move the thread; it resumes when the reader returns to the bottom or presses the button, which is shown whenever following is off. Follow scrolls are coalesced to one per animation frame rather than one per streamed chunk.
- **Surfaces:** Web, desktop shell.
- **Prerequisites:** A model that streams a response longer than the viewport.
- **Risk if wrong:** Readers watch a response grow off-screen, or the list yanks them back to the bottom while they are reading earlier messages.

## Verify

- [ ] Send a message that produces several screens of output. The thread follows the stream to the bottom without any manual scrolling.
- [ ] Mid-stream, scroll up. The thread releases on the first flick without fighting back, stays where you left it, and the stream keeps running below.
- [ ] Mid-stream, nudge up by less than a line. The thread still releases rather than snapping back on the next chunk.
- [ ] Mid-stream, flick up while the thread is already at the top, or rest two fingers on the trackpad without moving it. Following continues, because nothing actually moved.
- [ ] Mid-stream, scroll back down to the bottom. Following resumes on its own.
- [ ] Press "Scroll to bottom" mid-stream. Following resumes and the button disappears.
- [ ] Watch a fast response on both a trackpad and a mouse wheel. The follow reads as continuous rather than stepped or jittery.
- [ ] Scroll up mid-stream, then send another message. The thread returns to the bottom.
- [ ] Scroll up in a long conversation, then open a different conversation. It opens at the bottom.
- [ ] With the thread at the bottom, grow the composer with a multi-line draft. The last message stays visible.
- [ ] Open a shared conversation. It does not scroll on its own and shows no scroll button.
- [ ] Run a response that triggers a tool call or a compaction notice, and confirm the activity row at the end of the thread stays visible while it streams.

**Stop and report if:** the thread stops following mid-response, scrolls back down while you are reading earlier messages, resists an upward gesture, or shows the scroll button while it is still following.
