# Wisp animates on the standard eleven-row sheet

- **Change:** Wisp's sprite sheet was re-cut from the drifting nine-row image to the standard 1536 by 2288 `polychat-v1` grid, and the one-off `codex-v1` layout it needed was removed from the schemas. Wisp now has blink, preen and doze clips it previously lacked.
- **Surfaces:** Chat and Work pet sprite wherever Wisp is shown, including temporary conversations, the pet picker and the error page.
- **Prerequisites:** None. Custom pets stored against `codex-v1` fall back to the Polychat layout.
- **Risk if wrong:** Wisp renders clipped, jumps between clips, or shows an empty frame; any account pet recorded against the removed layout renders at the wrong size.
- **Commits:** Pending.

## Verify

- [ ] Open a temporary conversation and watch Wisp idle for several seconds; confirm the sprite is whole, does not jitter horizontally and blinks without a visible jump.
- [ ] Send a message and confirm the thinking, working and speaking clips each play the full character rather than a clipped or empty frame.
- [ ] Select Wisp in the pet picker beside Pip and Ash and confirm all three sit at the same size and baseline.
- [ ] If any account has a custom pet uploaded at 1536 by 1872, confirm it still renders and re-upload it at the standard size if it does not.

**Stop and report if:** any Wisp clip shows a sliced sprite, an empty frame or a size change between clips.
