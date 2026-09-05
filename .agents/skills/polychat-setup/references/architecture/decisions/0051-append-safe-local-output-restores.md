# 0051: Append safe local output restores

## Problem

Output history needs a useful reverse operation, but replacing the current row would erase lineage and a universal undo would falsely imply that connector calls, publications, generated files or sandbox repository changes were reversed. Concurrent edits and lost project membership also make a stale restore unsafe.

## Decision

Treat output history as an append-only sequence. A restore copies only the title and structured content of an earlier revision into a new current revision, records its parent and restored-from revision, and preserves current status, sensitivity and immutable provenance. Fence the write with the expected current revision and revalidate current output authority before loading the target revision.

Enable restore only for local text content whose effect is fully represented by those fields: article analysis, reports and summaries, notes, and Strudel patterns. Keep provider jobs, generated or uploaded files, connector results, publications and sandbox repository effects review-only. Their revisions remain comparable, but reversing their external effect requires a separate domain-specific compensation operation.

Store the current revision's actor, time, operation and restore lineage on the output row, and snapshot that metadata when advancing the revision. Legacy revisions derive created or updated labels without inventing restore lineage. Project restores write their audit record in the same D1 batch as the fenced output update.

## Status

Implemented.

## Consequences

Web can compare complete structured content side by side, while iPhone presents a compact changed-field and origin summary. Restoring never deletes history or rewrites provenance. The deliberately narrow support list can expand only when a capability's local state and any external compensation semantics are explicit.
