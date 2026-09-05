# ADR 0045: Reconstruct project task activity from authoritative records

Status: Accepted.

Project tasks already persist run events, messages, goal progress, interactions and completions, but each client previously interpreted a different subset. Persisting another progress feed would create a second account of execution and could disagree after retries, compaction or cross-device recovery.

## Decision

Project authorised task detail returns protocol version 1 `activity`. The API reconstructs it from every run scoped by both project and task identity, retained run events, run-keyed stored message parts, goal progress, the authoritative current interaction and task completions. It does not add a progress table or migration. If a legacy or trimmed run has no retained event for its current state, the projection adds a `run.snapshot` item from the run row.

Each presentation item carries stable project, task, run and source identities; an open `type`; a stable coarse category and status; safe title, optional summary and detail items; time; and actionable and terminal flags. Items are newest first. Proposed task outcomes use a null run because they predate execution. Actual activity uses its exact run where persisted or reconstructable. Unknown event types remain visible as generic, non-actionable activity. A new semantic category or incompatible field meaning requires a protocol-version change.

The projection deliberately excludes assistant reasoning, tool arguments and raw tool results. Tool activity names the tool and visible lifecycle only. Completion output is whitespace-normalised and bounded to a short preview; the durable result and conversation remain their full-detail surfaces.

Web renders the shared contract in `component-workspaces`, with details collapsed by default and the host retaining content-rendering ownership. iOS fetches the same contract during exact-task polling, keeps actionable and terminal items in its compact summary, and validates project and task identity before replacing local state. Both clients present failure, interruption, cancellation, waiting and terminal success distinctly without deriving state from prose.

## Trade-off

Task detail reads all runs for that task and their bounded event journals and messages. This costs more than a final-status read but keeps history coherent across reopening and devices without dual writes. G10, G11, G13, G15, G17 and G18 may add open event types and safe summaries within these identities; they must not insert raw provider payloads or create a disconnected progress store.
