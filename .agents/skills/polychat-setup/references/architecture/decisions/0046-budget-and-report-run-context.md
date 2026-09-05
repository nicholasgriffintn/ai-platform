# ADR 0046: Budget and report the context of each model step

Status: Accepted.

Conversation compaction protects archived-message coverage, but a run can still exceed a model window after tools return. Trimming only before the first model call also leaves people unable to tell whether a source, skill, summary or older result was actually present later in the run.

## Decision

Apply one context-budget policy before every model call in the shared agent loop. Reserve an explicit requested output limit when supplied, otherwise reserve 15% of the model window. Always retain system and developer instructions and the latest user-controlled message. Prefer the active compaction snapshot, then add the newest atomic assistant/tool steps while capacity remains. A smaller supported model therefore drops older steps before the latest user constraint.

Shorten provider copies of tool results above 6,000 characters with a head-and-tail excerpt and an explicit omission marker. Do not alter the stored message. Further pressure omits complete message units rather than claiming they remain in the prompt. G01's invariant remains unchanged: a compaction snapshot represents and archives only the complete messages supplied to its summary input.

Persist the latest step's protocol version 1 `context` snapshot on its exact run and attempt. It records the model and step, included and omitted message counts, attached-source references, ready or loaded skills, the active summary, bounded or omitted material, and context-window usage. Use provider input-token telemetry when present and label it `reported`; otherwise retain the local estimate and label it `estimated`. Clear the snapshot when a waiting run starts a new attempt so clients cannot present stale context.

Source and tool-output references point only to existing authorised resources. Source content still passes current Source and project membership checks. A full tool result remains subject to conversation access and message retention. The snapshot carries no credentials, tool arguments, private reasoning or approval authority. Summaries and omission markers explain model input; they cannot approve an operation or prove that omitted text was retained.

Web renders the contract through the controlled conversation package and resolves reference links in the host. iOS renders the same contract as a compact context sheet. The optional run field keeps independently released older clients compatible. Migration 0024 adds the nullable snapshot column and must precede API code that writes it; API deployment must precede clients that expect populated context.

## Trade-off

Character-based token estimates are deliberately labelled and may differ from provider accounting. Persisting only the latest step keeps the run row bounded and useful after reopening, but does not create a step-by-step context history. G12 may consume effective capability facts, while G16 and G17 may join this snapshot to provenance and settlement; those goals must preserve the reported-versus-estimated distinction and current authority checks.
