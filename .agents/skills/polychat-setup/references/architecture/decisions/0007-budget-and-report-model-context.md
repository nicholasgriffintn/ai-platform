# ADR 0007: Budget and report the context of each model step

Status: Implemented.

## Problem

Conversation compaction protects archived-message coverage, but a run can still exceed a model window after tools return. Trimming only before the first model call also leaves people unable to tell whether a source, skill, summary or older result was actually present later in the run.

## Decision

Apply one context-budget policy before every model call in the shared agent loop. Reserve an explicit requested output limit when supplied, otherwise 15% of the model window. Always retain system and developer instructions and the latest user-controlled message. Prefer the active compaction snapshot, then add the newest atomic assistant and tool steps while capacity remains, so a smaller model drops older steps before the latest user constraint.

Shorten provider copies of tool results above 6,000 characters with a head-and-tail excerpt and an explicit omission marker; do not alter the stored message. Further pressure omits complete message units rather than claiming they remain in the prompt.

Persist the latest step's protocol version 1 context snapshot on its exact run and attempt. It records the model and step, included and omitted message counts, attached-source references, ready or loaded skills, the active summary, bounded or omitted material, and context-window usage. Use provider input-token telemetry when present and label it `reported`; otherwise retain the local estimate and label it `estimated`. Clear the snapshot when a waiting run starts a new attempt.

Source and tool-output references point only to existing authorised resources and resolve against current authority. The snapshot carries no credentials, tool arguments, private reasoning or approval authority.

## Consequences

Character-based token estimates are deliberately labelled and may differ from provider accounting. Persisting only the latest step keeps the run row bounded and useful after reopening, but gives no step-by-step context history.
