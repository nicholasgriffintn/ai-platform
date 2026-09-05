# ADR 0043: Present coding work inside project conversations

Status: Accepted.

This decision defines presentation and contract ownership. The responsive web shell, conversation-scoped run discovery, terminal manifest, authorised Changes and Files views and unified Activity projection implement this boundary.

Polychat already has project conversations, sandbox runs, project tasks, Sources, Outputs and approvals. Treating their coding presentation as another product mode, route or runtime would duplicate authority and lifecycle state.

## Decision

Define **Project Workbench** as the responsive presentation of a coding-enabled project conversation inside Work. It has no identity, persistence or execution lifecycle of its own and remains within `/work/:workspaceId/projects/:projectId/chat`. A conversation is eligible when its project currently has a coding environment or when the conversation has an attached sandbox run; removing the configuration prevents new runs without hiding historical evidence.

A project owns configuration and shared scope. Its conversation remains the durable narrative and entry point and may have zero or more sandbox runs. A project task may own that same conversation and its goal, gates and completion evidence, but a task is not a sandbox run and ordinary conversations need no task. Sources remain durable inputs; Outputs remain durable results. Repository files, diffs, logs and commands are run evidence until an explicit server action records them as a Source or Output.

Use five semantic panes:

- **Conversation** is the message thread and the only pane available in every project conversation.
- **Activity** is a run-scoped projection of ordered events, commands, instructions and approval moments. It does not replace project-wide Activity; command output belongs here rather than in a sixth Terminal pane.
- **Changes** presents the selected run's authorised diff and changed-file data.
- **Files** presents the selected run's authorised repository snapshot or manifest. It is not the project's Sources collection.
- **Proof** composes terminal outcome, validation, branch or commit references, run artefacts, task completion evidence and linked Outputs. The composition is not itself a stored Output unless the user explicitly saves it.

When a selected run has a declared network service, add **Preview** as a contextual review pane. Preview does not change the five durable workbench meanings: it presents short-lived access to untrusted service content beside trusted Polychat controls. Route, viewport, an optional normalised region or user-authored element reference, and bounded feedback become an ordinary attributed `message` instruction on the selected run. They do not create a screenshot store, DOM bridge, browser-control grant or second conversation channel.

Finalise every terminal sandbox run into one versioned manifest on the run record. The manifest records the objective and terminal outcome, timestamps, repository revisions, changed-file summary, validation results, quality-gate outcome, branch or commit, authorised artefact references, model and measured infrastructure usage, residual risks and incomplete work. Success, failure and cancellation are distinct schema variants; absent optional evidence cannot change the terminal outcome.

Keep the manifest compact in the Activity record and store large logs, diffs, event streams and result payloads as private Outputs. Manifest artefact references expose Output identities and authorised content URLs, never R2 keys as authority. Use stable Output identities and a pure finalisation projection so delivery retry, usage-report retry or repeated terminal handling converges on the same Proof rather than creating another run or duplicate artefacts.

Fetch Changes and Files evidence through the referenced Output identity and its existing access check. Bound client reads before parsing or rendering, identify non-text content before decoding it, and preserve explicit unavailable, truncated, binary and failed-fetch states. Review ordering is a client projection: show contracts and configuration before consumers and tests while retaining the recorded paths and unified diff as API evidence.

Build Activity from the conversation's recorded agent trace and the selected run's ordered event array. Do not copy either history into a workbench record. Timestamp events at their producer, retain source order as the deterministic fallback for older events and reconcile streamed data with the same persisted run after reconnect. Group command and validation output into their lifecycle entry, derive duration only when start and finish times exist, and leave usage and latency explanations collapsed by default.

Activity may show recorded plans, concise action summaries, commands, approvals, user instructions, validation, errors, retries and terminal outcomes. It must not render model reasoning fields or tool arguments as chain-of-thought. Redact recognisable credential forms from displayed detail and keep bounded command evidence collapsed; private logs remain authorised Outputs rather than an Activity payload expansion.

Steer a live run through its existing sandbox instruction queue and execution-control record. Operator messages, continue requests and approval responses carry a client-generated idempotency key; the coordinator accepts the same request once, rejects reuse for different content and exposes submitted instructions and worker receipt events after reload. Pause and cancel take effect only at worker checkpoints, while resume releases a paused checkpoint. Control updates use the last observed server timestamp so a stale client conflicts instead of overwriting newer state; terminal state wins when cancellation races completion.

Record the current user on instructions accepted from the public API. Internal worker-authored approval requests may omit that actor. Preview annotations use the same runner-only instruction boundary, so the Activity event traces the annotation to its submitting user without granting the preview application any API credential or parent-page action.

Project membership permits these run records to be read. Only the initiating runner may add instructions, change run control or resolve its command approvals. Approval expiry and one-time resolution remain coordinator decisions, and presentation state such as an open steering dialog never grants or persists authority.

On wide surfaces, keep Conversation visible beside one selected supporting pane. Narrow web and iOS may show one pane at a time, use a drawer or navigate to a detail view. Pane names and contract semantics are shared; layout, navigation and local interaction state are not. Do not require React components to be shared with iOS.

The API owns project configuration; project, conversation, task and run associations; sandbox status, control revision, ordered events, instructions, results, terminal manifest and artefacts; task status, blocked reasons, gates and evidence; Source and Output provenance; and every authority or approval decision. Clients derive workbench eligibility, presentation labels, pane availability, badges, Proof layout, selected run, selected pane, diff mode, expansion and responsive layout. They do not reconstruct terminal Proof from incomplete events. Streamed client state is optimistic and must reconcile with authorised API records after refresh or reconnection. Do not add a persisted `workbench` record or status enum.

When no coding environment and no attached run exist, render the ordinary shared Work conversation with its project instructions, capabilities and Sources. Do not show disabled coding panes or imply a configuration error. When historical runs exist without current configuration, keep their panes readable and offer only controls still authorised by the API.

Keep four authority checks independent:

- Current workspace membership authorises project visibility; it does not grant execution.
- The person starting a turn or project task is the runner. Revalidate their account, usage, project and GitHub App authority at dispatch; project configuration selects a target and defaults but does not lend credentials.
- Connector credentials remain the current runner's personal provider connections and are never inferred from membership or sandbox access.
- Approvals remain exact, durable pending actions with their own actor policy and one-time resolution. Seeing a run, owning a credential or belonging to a project does not by itself approve an action.

## Trade-off

Clients must join several existing contracts and tolerate partial evidence, while the API needs conversation-scoped run reads and authorised file/change data before every pane can be complete. In return, one conversation, run system and authority model serve web and iOS without a third product mode, duplicate runtime or top-level route.
