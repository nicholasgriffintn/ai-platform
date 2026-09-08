# ADR 0042: An agent session is a long-lived handle, not a one-shot process

Status: Implemented for Codex in `apps/desktop`; the desktop application is not released. The remaining drivers stay on the batch path described in [0038](0038-spawn-only-compiled-agent-programs.md).

## Problem

[0038](0038-spawn-only-compiled-agent-programs.md) settled where an agent process may be spawned from and under what checks, and it assumed the shape the CLIs presented at the time: run the program once with the prompt in argv, read its standard output, exit. The core spawned with `stdin` closed and `stderr` discarded, and TypeScript pulled assistant text out of whatever JSON the program happened to print.

That shape cannot express most of what a coding agent does. A batch process has nowhere to send a permission request and nothing to receive an answer on, so a run that needed one could only fail; `desktop-run-stream.ts` told the person to go and use the CLI directly. It has no identity that survives the process, so every message started a new conversation behind a fresh folder picker, and the `--resume` handling already built in `build_argv` was unreachable because nothing captured a session id. Everything except assistant text — tool calls, command output, file changes, diffs, plans, reasoning, token counts — was parsed out and dropped. Discarding `stderr` meant a program that failed there reported nothing at all.

The capability table hid this rather than exposing it. One shared constant declared `reportsApprovals`, `resumesSessions`, `checkpoints` and `rollsBack` true for all five drivers, and the permission-mode picker read `reportsApprovals` to decide what to offer. Polychat therefore offered precisely the two modes it could not honour.

Both vendors now expose a second interface that answers all of this. Codex speaks JSON-RPC over stdio through `codex app-server`, with methods for listing models, starting, resuming and forking threads, and server-initiated requests for command and file-change approvals. Claude Code carries a control channel in the other direction over `--input-format stream-json`.

## Decision

Model an agent session as a long-lived handle that a conversation owns, and keep the batch path underneath it for drivers that have no session protocol.

The core spawns the session program with both pipes open and supervises it across turns. Standard output crosses the bridge as raw lines exactly as 0038 requires, so protocol knowledge stays in TypeScript; standard error crosses as a diagnostic event rather than being discarded. The renderer still selects a compiled driver and never supplies a program name, and the same directory-grant, canonicalisation and refusal rules apply unchanged.

A session is keyed by driver and conversation. One conversation owns one process and one native thread, so a second message resumes rather than restarts, and answering an approval reaches the run that asked. A single process could serve several conversations through the protocol's own thread multiplexing, and the protocol supports it, but that requires one adapter demultiplexing threads across conversations and a request-id space shared between them. The simpler binding is correct first; sharing is an optimisation to make when the process count justifies it.

A conversation's binding — its directory, its native thread, its model, its reasoning effort and its permission mode — is persisted on the device. Revoking a folder grant drops the bindings that pointed at it, so a conversation is never left addressing a directory Polychat may no longer reach.

Every driver reports what it actually implements. Only a driver with a session adapter claims to resume sessions, list models or answer approvals. Permission modes follow from that: a mode is offered when the driver can honour it, and the reason is stated when it cannot.

Modes translate per driver rather than being passed through. For Codex, Supervised is an untrusted policy over a read-only sandbox, Auto-accept edits and Auto share the same workspace-write sandbox, and they differ only in who reviews — Auto hands approvals to the agent's own review rather than to the person. Full access switches approvals off. Only Supervised depends on an approval channel; Auto-accept edits needs none, because nothing has to be answered for an edit to proceed.

## Consequences

A conversation with a session driver keeps its thread, so context survives between messages and the folder is chosen once. Approvals become answerable, which makes Supervised meaningful for the first time. Tool calls, command output, file changes, diffs, plans, reasoning and token usage all arrive as structured events, so the surfaces that render them have something to render and the usage ledger has something to record.

Two costs follow. Long-lived processes accumulate: one per conversation with an agent, released when the session is stopped or the application exits, and a person working across many repositories will hold several. And the protocols are young — `codex app-server` is marked experimental and has already moved its whole conversation API within minor versions — so the mapping is generated from the pinned CLI's own bindings, checked by contract tests, and expected to break loudly rather than quietly.

The batch path is not deprecated. It remains the honest answer for a driver with no session protocol, and a run falls back to it when the driver reports no session support. Adding a driver to the session path means writing an adapter and telling the truth about it in the capability table, not widening a shared constant.
