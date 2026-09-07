# ADR 0026: Snapshot output provenance and append safe restores

Status: Implemented.

## Problem

Model choices, loaded skill revisions, sources and approval state change after an execution creates a durable output. Resolving those facts from current settings makes an old result appear to have a different origin, while copying prompts or unrestricted tool data would expose more than an explanation needs.

Output history separately needs a useful reverse operation, but replacing the current row would erase lineage, and a universal undo would falsely imply that connector calls, publications, generated files or sandbox repository changes had been reversed.

## Decision

Use the stored chat run context as execution provenance and snapshot its bounded effective facts onto each new durable output: the producing run and attempt when present, the model and provider actually used after handoffs, loaded skill revisions, source identifiers and names, and approval identifiers, outcomes and tool names. Do not store prompts, tool arguments, credentials or cost data in the provenance contract.

Keep output provenance immutable when the output content changes, and copy it into each output revision so current configuration cannot rewrite history. Resolve source availability against current source authority when returning output detail or revisions, expose no direct source path, and omit provenance from public share responses and output lists. Treat outputs without a valid snapshot as legacy, and new outputs whose producer cannot supply all effective facts as partial. A later source attachment promotes a legacy record to partial but does not invent a run or model. Deletion or lost access changes the response state to unavailable without deleting the historical identifier.

Treat output history as an append-only sequence. A restore copies only the title and structured content of an earlier revision into a new current revision, records its parent and restored-from revision, and preserves current status, sensitivity and immutable provenance. Fence the write with the expected current revision and revalidate current output authority before loading the target revision.

Enable restore only for local text content whose effect is fully represented by those fields: article analysis, reports and summaries, notes, and Strudel patterns. Keep provider jobs, generated or uploaded files, connector results, publications and sandbox repository effects review-only; their revisions remain comparable, but reversing their external effect requires a separate domain-specific compensation operation. Store the current revision's actor, time, operation and restore lineage on the output row, and write project restores in the same D1 batch as their audit record.

## Consequences

Output detail and run context can explain the effective producer without consulting mutable defaults. Direct provider pipelines must pass their actual model and provider when known; older and structurally indirect pipelines remain explicitly partial rather than receiving a speculative backfill. Restoring never deletes history or rewrites provenance, and the deliberately narrow support list can expand only when a capability's local state and any external compensation semantics are explicit.
