# ADR 0023: Present coding work inside project conversations

Status: Implemented.

## Problem

Polychat already has project conversations, sandbox runs, project tasks, Sources, Outputs and approvals. Treating their coding presentation as another product mode, route or runtime would duplicate authority and lifecycle state.

## Decision

Define **Project Workbench** as the responsive presentation of a coding-enabled project conversation inside Work. It has no identity, persistence or execution lifecycle of its own and stays within the project conversation route. A conversation is eligible when its project currently has a coding environment or when the conversation has an attached sandbox run; removing the configuration prevents new runs without hiding historical evidence.

A project owns configuration and shared scope. Its conversation remains the durable narrative and may have zero or more sandbox runs. A project task may own that same conversation and its goal, gates and completion evidence, but a task is not a sandbox run and ordinary conversations need no task. Repository files, diffs, logs and commands are run evidence until an explicit server action records them as a Source or Output.

Use five semantic panes:

- **Conversation** is the message thread and the only pane available in every project conversation.
- **Activity** is a run-scoped projection of ordered events, commands, instructions and approval moments. Command output belongs here rather than in a sixth Terminal pane.
- **Changes** presents the selected run's authorised diff and changed-file data.
- **Files** presents the selected run's authorised repository snapshot or manifest. It is not the project's Sources collection.
- **Proof** composes terminal outcome, validation, branch or commit references, run artefacts, task completion evidence and linked Outputs. It becomes an Output only when the user explicitly saves it.

When a selected run has a declared network service, add **Preview** as a contextual review pane under [0025](0025-gate-sandbox-previews-through-project-authority.md). It presents short-lived access to untrusted service content beside trusted Polychat controls; route, viewport, an optional normalised region or user-authored element reference and bounded feedback become an ordinary attributed `message` instruction on the selected run, not a screenshot store, DOM bridge or second conversation channel.

Finalise every terminal sandbox run into one versioned manifest on the run record, recording objective and terminal outcome, timestamps, repository revisions, changed-file summary, validation results, quality-gate outcome, branch or commit, authorised artefact references, model and measured infrastructure usage, residual risks and incomplete work. Success, failure and cancellation are distinct schema variants; absent optional evidence cannot change the terminal outcome. Keep the manifest compact and store large logs, diffs, event streams and result payloads as private Outputs, exposing Output identities and authorised content URLs rather than storage keys. Use stable Output identities and a pure finalisation projection so retry or repeated terminal handling converges on the same Proof.

Build Activity from the conversation's recorded agent trace and the selected run's ordered event array; do not copy either history into a workbench record. Timestamp events at their producer and retain source order as the deterministic fallback for older events. Group command and validation output into their lifecycle entry, and derive duration only when start and finish times exist. Activity may show recorded plans, concise action summaries, commands, approvals, user instructions, validation, errors, retries and terminal outcomes; it must not render model reasoning fields or tool arguments as chain-of-thought. Redact recognisable credential forms and keep bounded command evidence collapsed.

Fetch Changes and Files evidence through the referenced Output identity and its existing access check. Bound client reads before parsing or rendering, identify non-text content before decoding, and preserve explicit unavailable, truncated, binary and failed-fetch states. Review ordering is a client projection: show contracts and configuration before consumers and tests while retaining the recorded paths and unified diff as API evidence.

Steer a live run through its existing sandbox instruction queue and execution-control record. Operator messages, continue requests and approval responses carry a client-generated idempotency key; the coordinator accepts the same request once and rejects reuse for different content. Pause and cancel take effect only at worker checkpoints, and control updates use the last observed server timestamp so a stale client conflicts instead of overwriting newer state; terminal state wins when cancellation races completion. Record the current user on instructions accepted from the public API.

Keep four authority checks independent. Current workspace membership authorises project visibility but grants no execution. The person starting a turn or task is the runner, whose account, usage, project and GitHub App authority is revalidated at dispatch. Connector credentials remain the runner's personal provider connections. Approvals remain exact, durable pending actions with their own actor policy and one-time resolution.

The API owns configuration, associations, run and task state, event order, instructions, results, the terminal manifest, artefacts, provenance and every authority decision. Clients derive eligibility, labels, pane availability, badges, Proof layout, selected run and pane, diff mode, expansion and responsive layout, and must not reconstruct terminal Proof from incomplete events. On wide surfaces keep Conversation beside one supporting pane; narrow web and iOS may show one pane, a drawer or a detail view. Pane names and contract semantics are shared; layout and local interaction state are not, and React components need not be shared with iOS. Do not add a persisted `workbench` record or status enum.

## Consequences

Clients must join several existing contracts and tolerate partial evidence, while the API needs conversation-scoped run reads and authorised file and change data before every pane can be complete. In return, one conversation, run system and authority model serve every client without a third product mode, duplicate runtime or top-level route.
