# ADR 0064: Snapshot effective provenance on durable results

## Problem

Model choices, loaded skill revisions, sources and approval state can change after an execution creates a durable output. Resolving those facts from current settings makes an old result appear to have a different origin, while copying prompts or unrestricted tool data would expose more than an explanation needs.

## Decision

Use the stored chat run context as execution provenance and snapshot its bounded effective facts onto each new durable output. Record the producing run and attempt when present, the model and provider actually used after handoffs, loaded skill revisions, source identifiers and names, and approval identifiers, outcomes and tool names. Do not store prompts, tool arguments, credentials or cost data in the provenance contract.

Keep output provenance immutable when the output content changes. Copy it into each output revision so current configuration cannot rewrite history. Resolve source availability against current source authority when returning output detail or revisions, expose no direct source path in output provenance, and omit provenance from public share responses and output lists.

Treat outputs without a valid snapshot as legacy, and new outputs whose producer cannot supply all effective facts as partial. A later source attachment promotes a legacy record to partial but does not invent a run or model. Deletion or lost access changes the response state to unavailable without deleting the historical identifier or implying continuing access.

## Status

Implemented.

## Consequences

Web output detail and web/iPhone run context can explain the effective producer without consulting mutable defaults. Direct provider pipelines must pass their actual model and provider when known; older and structurally indirect pipelines remain explicitly partial rather than receiving a speculative backfill. Output revision comparison can reuse the immutable snapshots, and usage settlement remains a separate concern.
