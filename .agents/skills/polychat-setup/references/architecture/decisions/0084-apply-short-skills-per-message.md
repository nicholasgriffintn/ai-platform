# ADR 0084: Apply short skills to the messages they help with

Status: Implemented for built-in and authored skills that opt in.

## Problem

ADR 0013 discloses skills by name and description and loads a body only when the model calls `load_skill`. That is right for playbooks, but wrong for short standing instructions such as a house style or a preference for how reports are laid out. They cost a tool call every time, and the model often skips optional guidance, so the person keeps re-explaining it.

## Decision

A skill may set `metadata.activation: per-message`. `save_skill` sets it when asked to apply instructions automatically. Such a skill must keep its body to 2 KB; longer bodies are never applied this way.

- Before each turn, up to eight ready per-message skills are offered to one decision-provider request (ADR 0045) that asks, per skill, whether it clearly helps with the current message. At most three at 0.65 or above are applied.
- Selection has a 1.5 second deadline and runs alongside the rest of request preparation. A timeout, an error or an unavailable provider applies nothing; the turn never waits longer or fails because of it.
- Applied bodies are added to the current turn's provider message only. They are not stored in the conversation, so later turns choose again and earlier prompt prefixes stay cacheable.
- Availability is unchanged: only skills already ready for the conversation can be applied, and `load_skill` still serves every skill.

## Consequences

Short preferences follow the person without a tool call, and a slow decision provider costs at most the deadline. The current message is sent to the decision provider, as tool-intent checks already do. Selection quality depends on skill names and the message alone, so a vaguely named skill may not be applied; authors should name per-message skills by what they do.
