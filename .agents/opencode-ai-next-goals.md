# OpenCode-inspired second-wave AI goals

> **Status:** working planning artefact, prepared 5 September 2026. This file is not canonical architecture, an accepted decision, or authorisation to implement. Re-check every claim against the then-current checkout before starting a goal.

## Evidence baseline

These briefs follow the [full runtime comparison](opencode-ai-review.md). The OpenCode evidence is pinned to [`5b1e31988ed74b821b3a7ca6647188446992aafc`](https://github.com/anomalyco/opencode/tree/5b1e31988ed74b821b3a7ca6647188446992aafc), release `1.18.29`, committed 4 September 2026. The Polychat evidence baseline is commit `e0dd1b094f31ea2680d2c28e1118e71abc8b6153` on 5 September 2026 and its [architecture context](skills/polychat-setup/references/architecture/context.md).

The order below is recommended. Each item is independently bounded; do not combine them into a broad runtime rewrite.

| Priority | Goal                                                      | Why now                                                                                                   |
| -------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1        | Preserve turns under context pressure                     | Fixes two demonstrated ways that compaction can lose recent causality.                                    |
| 2        | Make MCP configuration executable and routing exact       | Removes a user-selectable transport that cannot run and a wrong-server fallback at an execution boundary. |
| 3        | Expose MCP readiness where agents are configured          | Turns silent capability loss into an actionable, authorised state.                                        |
| 4        | Bring exact connector approvals to iOS                    | Closes a cross-client authority interaction gap using an existing backend contract.                       |
| 5        | Load nested repository instructions in sandbox runs       | Improves coding-run correctness without broadening ordinary Chat or Work context.                         |
| 6        | Make stored-turn inspection accurate and available on iOS | Gives both clients a durable, read-only explanation of completed work without event replay.               |

## Goal 1: Preserve complete recent turns under context pressure

**User problem and measurable outcome.** In a long conversation, a compacted context can currently separate a tool request from its result, and the newest archived facts can be absent from summary input. After this goal, every retained or archived boundary must fall between complete user turns, and the bounded summary input must preferentially retain the newest archived complete turns while remaining chronological. Existing persisted coverage must identify exactly the represented messages.

**Existing Polychat Module and Seam.** Keep selection and formatting in [`lib/session/compaction.ts`](../apps/api/src/lib/session/compaction.ts). Preserve [`SessionManager`](../apps/api/src/lib/session/SessionManager.ts), the existing compaction snapshot/marker, [`compaction-stream.ts`](../apps/api/src/lib/chat/core/compaction-stream.ts), and the current client contract.

**OpenCode behaviour to adapt.** OpenCode selects a recent tail backwards by token budget, reasons about whole turns, and carries a completed prior summary into later compaction. See its [`session/compaction.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/compaction.ts), [`session/message-v2.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/message-v2.ts), and [`session/prompt.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/prompt.ts).

**Evidence.** Polychat uses `DEFAULT_KEEP_RECENT_MESSAGES = 8` and a message-count slice. Its summary formatter consumes archived messages oldest-first until 16,000 characters. Those behaviours are asserted in the current [compaction tests](../apps/api/src/lib/session/__test__/compaction.test.ts); neither protects a user/assistant/tool turn boundary or guarantees representation of the newest archived facts.

**Scope.** Select the active tail backwards using the existing token estimator and complete user-turn boundaries. Build bounded summary input from newest archived complete turns, then present the selected material chronologically. Include a previous active snapshot when repeated compaction would otherwise discard it. Keep the current fallback deterministic and make its coverage truthful.

**Non-goals.** Do not add semantic event replay, a new summary store, opaque provider history, automatic synthetic continuation, a new model, or client controls for compaction policy.

**Surfaces.** Backend only for selection, formatting, persistence, and tests. Web and iOS continue to render the existing compaction marker and state; verify that stored snapshots still decode and that neither client assumes a fixed eight-message tail.

**Contract and persistence.** No wire-schema change should be needed. Preserve snapshot and marker roles, represented message IDs, archive order, rollback behaviour, and coordinator ownership. If existing coverage cannot express a prior snapshot accurately, stop and review the schema rather than hiding the loss.

**Security and authority.** Compaction must operate only on the already-authorised conversation history. Do not place message content in logs or metrics. Treat summary output as model-generated data and preserve existing sanitisation and storage bounds.

**Tests, rollout, and human verification.** Extend the current compaction suite with a tool call/result at the old eighth-message boundary, parallel tool results, repeated compaction, an oversized oldest turn, and newest-fact retention. Build schemas first if coverage changes. Roll out as a server-only behaviour change and compare compaction failure rate and post-compaction provider errors. Human verification is limited to the unchanged marker and successful continuation on web and iOS.

**Dependencies and ADRs.** No new dependency. This deepens [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md) without reopening its replay decision. A new persistence model or provider-only continuation would require a separate ADR.

## Goal 2: Make MCP configuration executable and tool routing exact

**User problem and measurable outcome.** An agent can be saved with `stdio`, but the Cloudflare runtime rejects that transport. During execution, a missing server match can also fall back to the first live connection, risking a call against the wrong server. After this goal, every transport accepted by the saved-agent schema must be executable in production, and every MCP invocation must resolve one exact request-scoped `(agent, server, tool)` target or fail closed before I/O.

**Existing Polychat Module and Seam.** Use the shared [`mcpServerSchema`](../packages/schemas/src/agents.ts), [`mcp-client.ts`](../apps/api/src/services/agents/mcp-client.ts), request-scoped registration and execution in [`functions/mcp.ts`](../apps/api/src/services/functions/mcp.ts), tool collection in [`completion-tools.ts`](../apps/api/src/services/agents/completion-tools.ts), and the existing [`ConnectionsSection`](../packages/component-account/src/Agents/AgentEditor/ConnectionsSection.tsx).

**OpenCode behaviour to adapt.** OpenCode gives each configured server a stable configuration key, retains that identity through discovery, and calls a tool on that exact client. Its transport and status lifecycle is centralised in [`mcp/index.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/mcp/index.ts). Adapt the identity discipline, not OpenCode's local-process trust model or command transport.

**Evidence.** [`mcpServerSchema`](../packages/schemas/src/agents.ts) and the editor accept `stdio`, `command`, and `args`; [`connectMCPServerReady`](../apps/api/src/services/agents/mcp-client.ts) returns “Stdio MCP servers are not supported in this runtime”. [`executeTool`](../apps/api/src/services/functions/mcp.ts) uses the first available connection when a name does not reveal a connection ID, while missing tool names are resolved by substring if there is one fuzzy match.

**Scope.** Align the shared schema, editor, API parsing, and runtime on remote transports the deployed MCP client actually executes. Preserve a stable server identity from discovery in the request-scoped registry and include it in the provider-facing tool mapping within provider name limits. Resolve the exact registered server and exact discovered tool at execution. Remove substring matching and first-connection fallback. Fail with the existing tool-error path when the mapping is stale or absent.

**Non-goals.** Do not execute local commands, add an MCP proxy, add OAuth, persist live MCP sessions, trust a model-supplied URL/server ID, redesign all agent tools, or copy OpenCode's dynamic catalogue installation.

**Surfaces.** Backend and shared schemas own transport truth and exact execution. Web removes unsupported fields/options and explains supported remote transports. iOS has no saved-agent MCP editor in the inspected client, so it requires only rolling-decoder compatibility unless that product surface is added separately.

**Contract and persistence.** This narrows the saved-agent MCP configuration contract. Parse existing `stdio` records as unavailable rather than attempting them; do not silently reinterpret them. The exact execution mapping remains request-scoped and ephemeral. No durable tool-session or message format change is required.

**Security and authority.** Retain [`requireAgentAccess`](../apps/api/src/services/agents/access.ts), executing-scope checks under saved-agent composition, outbound URL validation, permission checks, approval policy, bounded timeout, and client disposal. Exact mapping must be created only from a successful authorised discovery response. Never use a server URL or tool name from model arguments as authority.

**Tests, rollout, and human verification.** Add schema/editor migration tests for legacy `stdio`; multi-server tests with duplicate tool names; stale mapping, unknown tool, fuzzy-name, timeout, cancellation, and disposal tests; and an integration test proving server B cannot be called through server A's mapping. Roll out with counts of configuration-unavailable and exact-resolution failures, using no URLs or tool arguments in telemetry. Verify saving supported transports and the legacy unavailable state in personal and workspace agent editors.

**Dependencies and ADRs.** Build schemas before consumers. No new dependency is expected. This implements the executing-scope rule in [ADR 0036](skills/polychat-setup/references/architecture/decisions/0036-agents-composed-from-platform-capabilities.md) and exact activation in [ADR 0029](skills/polychat-setup/references/architecture/decisions/0029-server-managed-tool-selection.md). Any durable upstream session or credential authority would require a new decision aligned with [ADR 0013](skills/polychat-setup/references/architecture/decisions/0013-composio-run-approval-and-event-boundaries.md).

## Goal 3: Expose MCP readiness where agents are configured

**User problem and measurable outcome.** MCP setup failures are currently logged and their tools disappear, so an agent can look valid but silently lack promised capabilities. After this goal, every saved MCP server must show one bounded readiness state—ready, authentication required, unreachable, unsupported legacy configuration, or not checked—and a failed server must contribute no tools while leaving healthy servers usable.

**Existing Polychat Module and Seam.** Reuse the authorised [`GET /agents/:agentId/servers`](../apps/api/src/routes/agents/index.ts), [`getAgentServers`](../apps/api/src/services/agents/getAgentServers.ts), [`connectMCPServerReady`](../apps/api/src/services/agents/mcp-client.ts), the agent API service in [`agent-service.ts`](../apps/app/src/lib/api/services/agent-service.ts), and the shared agent editor's [`ConnectionsSection`](../packages/component-account/src/Agents/AgentEditor/ConnectionsSection.tsx).

**OpenCode behaviour to adapt.** OpenCode treats MCP connection status, authentication, errors, tools, resources, and prompts as one observable lifecycle in [`mcp/index.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/mcp/index.ts), and exposes configuration separately from runtime status in [`mcp/catalog.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/mcp/catalog.ts). Polychat should adapt only the visible lifecycle states needed to explain agent readiness.

**Evidence.** [`completion-tools.ts`](../apps/api/src/services/agents/completion-tools.ts) catches setup and per-server failures, logs them, and returns only collected tool definitions. The editor does not call the existing servers endpoint or render connection state. The endpoint already enforces agent read access and returns connection state or an error, so the missing seam is client consumption and a bounded response contract rather than a second discovery service.

**Scope.** Define the current endpoint response in shared schemas, return a stable server ID plus safe status and counts, dispose its temporary client on every path, and consume it for already-saved agents in the shared web editor. Refresh only on explicit user action or a bounded query policy. Keep completion-time failures fail-closed and surface a concise unavailable reason through the existing agent/capability presentation where practical.

**Non-goals.** Do not expose raw URLs to non-managers, return remote error bodies, implement authentication, live-poll connections, persist transient status, or make readiness a substitute for execution-time authority.

**Surfaces.** Backend formalises and sanitises the existing endpoint. Web presents per-server status and retry in the existing editor. iOS has no agent editor and needs only tolerant decoding if the agent response gains additive readiness summaries; avoid adding an iOS management screen in this goal.

**Contract and persistence.** Add a response schema for the existing route; prefer safe status codes and tool/resource/prompt counts over raw remote objects or error text. No database change. Runtime state remains ephemeral and must be rechecked at completion time.

**Security and authority.** Preserve personal/workspace read authority and distinguish read from manage presentation. Redact URLs and upstream errors for users who cannot manage the agent. Keep SSRF controls and executing-scope permission checks at actual connection and call boundaries. Readiness never grants a tool.

**Tests, rollout, and human verification.** Test each state, mixed healthy/failed servers, access denial, redaction, timeout, and guaranteed disposal. Test editor loading, retry, partial success, and unavailable copy. Roll out behind the existing agent editor request path and monitor low-cardinality status counts. Verify manager/read-only views and keyboard/screen-reader status on web.

**Dependencies and ADRs.** Depends on Goal 2's truthful transport and exact identity work. No new dependency. Compatible with [ADR 0036](skills/polychat-setup/references/architecture/decisions/0036-agents-composed-from-platform-capabilities.md); persisting readiness as authority would conflict with it.

## Goal 4: Bring exact connector approval explainability and resolution to iOS

**User problem and measurable outcome.** A connector write can leave an iOS conversation waiting for approval without the native client showing the exact provider, operation, safe argument summary, expiry, or approve/reject controls already available on web. After this goal, the same persisted approval message must render equivalent safe facts and resolve the same opaque approval ID on iOS; stale, expired, unauthorised, and duplicate resolutions must remain non-executing failures.

**Existing Polychat Module and Seam.** Preserve the shared approval reader and vocabulary in [`connector-approval.ts`](../packages/schemas/src/connector-approval.ts), exact server resolution in [`operation-approvals.ts`](../apps/api/src/services/apps/connectors/operation-approvals.ts), hydration in [`approval-message-state.ts`](../apps/api/src/services/apps/connectors/approval-message-state.ts), the existing [`PUT /apps/connectors/approvals/:approvalId`](../apps/api/src/routes/apps/connectors.ts), and web reference behaviour in [`ConnectorApprovalCard`](../packages/component-conversation/src/Message/ConnectorApprovalCard.tsx). Extend iOS's [`ChatMessage`](../apps/mobile/ios/Polychat/Models/ChatMessage.swift), [`APIClient`](../apps/mobile/ios/Polychat/Services/APIClient.swift), protocol seam, and existing message-part rendering.

**OpenCode behaviour to adapt.** OpenCode makes permission requests visible as a named operation with patterns and metadata before the user answers; see [`permission/index.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/permission/index.ts) and [`session/tools.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/tools.ts). Adapt its explain-before-answer principle, not its in-memory approval authority or last-match permission rules.

**Evidence.** Web parses and renders the provider, operation, expiry, state, and `argumentSummary`, then resolves the opaque ID. The inspected iOS `ChatMessageData` does not decode those fields, `ConversationAPIClient` has no approval-resolution method, and native message rendering has no connector-approval branch. Semantic `waiting_for_user` activity intentionally signals only that authority is pending and cannot replace the persisted approval receipt.

**Scope.** Decode the established approval fields and bounded redacted argument summary, render a native approval card in the existing tool-result message, call the existing exact resolution route, refresh the conversation after success, and disable controls for terminal/expired states. Match web wording and state semantics where platform conventions allow.

**Non-goals.** Do not move approval authority into the client, execute connectors directly, invent local optimistic authority, expose credentials/raw arguments, broaden generic human-in-the-loop UI, or change the connector replay/reconciliation model.

**Surfaces.** iOS is the product change. Backend should require no behavioural change beyond confirming the existing route and hydrated history contract. Web is the conformance reference and receives only shared-copy/schema fixes if evidence shows drift.

**Contract and persistence.** Reuse the current persisted approval message and resolution request. Any formal response-schema addition must be additive for rolling clients. The client may show local loading state but must render final authority from refreshed server history.

**Security and authority.** The opaque approval ID is not sufficient by itself: retain current authenticated user ownership, expiry, exact argument digest, one-time claim, revalidation, and indeterminate-result handling under [ADR 0013](skills/polychat-setup/references/architecture/decisions/0013-composio-run-approval-and-event-boundaries.md). Use only the server-produced redacted summary. Never log approval arguments.

**Tests, rollout, and human verification.** Add iOS decoding and presentation tests for pending, approved, rejected, consumed, expired, malformed, and redacted details; API-client tests for exact ID and resolution; manager tests for refresh and failure. Re-run existing backend approval suites and `pnpm test:mobile`. Verify VoiceOver, Dynamic Type, background/foreground refresh, expiry while open, and duplicate taps on a device.

**Dependencies and ADRs.** No new dependency or database change. This is client parity for accepted [ADR 0013](skills/polychat-setup/references/architecture/decisions/0013-composio-run-approval-and-event-boundaries.md), not an ADR change.

## Goal 5: Load applicable nested repository instructions during sandbox reads

**User problem and measurable outcome.** A sandbox coding run can read a file beneath a repository-specific instruction boundary without seeing the nearest instructions that govern that subtree. After this goal, the first authorised read beneath an applicable instruction file must add that file once to later model context, with its repository-relative provenance; reads outside the checkout, duplicate loads, symlink escapes, and unsupported filenames must add nothing.

**Existing Polychat Module and Seam.** Deepen the sandbox worker's bounded repository context in [`context.ts`](../apps/sandbox-worker/src/lib/feature-implementation/context.ts), the existing read action in [`agent-loop-actions.ts`](../apps/sandbox-worker/src/lib/feature-implementation/agent-loop-actions.ts), prompt composition in [`prompts.ts`](../apps/sandbox-worker/src/lib/feature-implementation/prompts.ts), and run state in [`types.ts`](../apps/sandbox-worker/src/lib/feature-implementation/types.ts). Reuse the run-event/provenance path rather than changing normal chat preparation.

**OpenCode behaviour to adapt.** After a file read, OpenCode walks from the file towards the project root, finds recognised instruction files not already loaded, and adds their contents to the session context. See [`session/instruction.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/instruction.ts), [`session/system.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/system.ts), and [`session/llm/request.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/llm/request.ts).

**Evidence.** Polychat's [`collectRepositoryContext`](../apps/sandbox-worker/src/lib/feature-implementation/context.ts) discovers top-level context plus PRD and `.implement` files at run start. The inspected read action returns a bounded snippet but does not search parent directories for `AGENTS.md`/`CLAUDE.md`-style subtree instructions or track which such files have entered the run.

**Scope.** Choose a small explicit filename allowlist already supported by product policy. After a successful in-checkout file read, walk only its lexical/real parent chain to the authorised repository root, load the nearest applicable instruction files within existing byte/file limits, and add each once to subsequent model context. Record path and load time through existing run provenance/events. Define precedence below platform, sandbox, workspace, and explicit task instructions.

**Non-goals.** Do not scan ordinary Chat/Work attachments, search outside the checkout, execute instruction-file content, load arbitrary Markdown, watch for instruction changes mid-run, add a plugin system, or make repository text an authority source.

**Surfaces.** Sandbox worker owns discovery, state, and prompt assembly. Backend only relays existing run events. Web may show loaded-file provenance in existing sandbox run detail; iOS has no sandbox-run surface in scope and needs no work.

**Contract and persistence.** Prefer additive fields on existing run events only if provenance cannot be represented today. No new durable instruction store; the run's bounded state may remember loaded relative paths. Do not persist full instruction contents in activity metadata.

**Security and authority.** Canonicalise paths, reject symlink and traversal escapes, bound depth/count/bytes, and treat repository instructions as untrusted prompt input subordinate to server policy. Maintain command approvals and workspace/repository authority at execution. Do not leak private repository paths or content through analytics.

**Tests, rollout, and human verification.** Extend [feature context tests](../apps/sandbox-worker/src/lib/__test__/feature-context.test.ts) and [agent-loop tests](../apps/sandbox-worker/src/lib/__test__/feature-agent-loop.test.ts) for root/nested precedence, sibling isolation, duplicate reads, malformed/oversized files, symlink/traversal attempts, and context-budget behaviour. Roll out only for sandbox feature-implementation runs. Verify one real repository with nested instructions and confirm provenance without instruction body exposure.

**Dependencies and ADRs.** No new dependency. Compatible with [ADR 0009](skills/polychat-setup/references/architecture/decisions/0009-canonical-workspace-resources.md) only because discovery is limited to an already-authorised checkout; extending it to normal Chat or Work would require architectural review. It must remain subordinate to [ADR 0036](skills/polychat-setup/references/architecture/decisions/0036-agents-composed-from-platform-capabilities.md).

## Goal 6: Make stored-turn inspection accurate and available on iOS

**User problem and measurable outcome.** Users can see that an answer used models and tools, but iOS has no equivalent of web's conversation trace, and web labels the message `platform` as a provider. After this goal, web and iOS must derive the same ordered, safe inspection entries from the same stored-message fixture, never claim a provider when only platform is known, and show model call, assistant response, tool call/result, approval, retry, error, timing, usage, and authored-skill provenance only when represented by stored data.

**Existing Polychat Module and Seam.** Deepen the pure projection in [`library-chat/agent-trace.ts`](../packages/library-chat/src/agent-trace.ts), its display vocabulary in [`agent-trace-display.ts`](../packages/library-chat/src/agent-trace-display.ts), the web [`AgentTracePanel`](../packages/component-conversation/src/AgentTracePanel.tsx), and header composition in [`ConversationProductHeader`](../apps/app/src/components/ConversationThread/ConversationProductHeader.tsx). Add a native projection beside existing iOS utilities and expose it from [`ChatView`](../apps/mobile/ios/Polychat/Views/ChatView.swift) using already-fetched conversation messages.

**OpenCode behaviour to adapt.** OpenCode's persisted message-part lifecycle and timeline let users inspect the order and terminal state of reasoning, tools, retries, and errors. See [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/processor.ts), [`session/status.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/status.ts), [`message-timeline.tsx`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/app/src/pages/session/timeline/message-timeline.tsx), and [`timeline/rows.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/app/src/pages/session/timeline/rows.ts).

**Evidence.** [`buildAgentTraceEntries`](../packages/library-chat/src/agent-trace.ts) currently assigns `message.platform` to the `provider` field. The web panel does not render the projection's `detail`, and iOS has no trace projection or entry point in the inspected chat views. The stored message and part models already contain most safe lifecycle facts, so a new event store is unsupported.

**Scope.** Correct the web projection's semantics; define a bounded display-safe detail policy; preserve deterministic ordering and de-duplication; and implement the equivalent native projection from persisted `ChatMessage`/parts. Use one provider-neutral fixture corpus where practical. Add a trace entry point in the existing iOS chat toolbar and preserve the current web panel's component boundary.

**Non-goals.** Do not persist ephemeral turn-activity events, introduce replay, add OpenTelemetry UI, fetch provider logs, infer unseen events, expose chain-of-thought, show raw credentials/headers/tool payloads, or make trace data an authority source.

**Surfaces.** Shared TypeScript projection and web presentation; iOS native projection and presentation. Backend changes only if an already-persisted safe field is accidentally omitted from conversation reads. Do not add a trace endpoint merely to obtain parity.

**Contract and persistence.** No wire or persistence change is expected. Derive inspection from stored messages and parts, tolerating unknown additive fields. If provider identity is not stored, omit it rather than repurposing platform or changing the schema in this goal.

**Security and authority.** Conversation-read authority remains the boundary. Redact or omit tool arguments/results by default using a strict allowlist of display-safe summaries; never expose hidden reasoning, connector credentials, repository secrets, or raw provider errors. Workspace users see only conversations they can already read.

**Tests, rollout, and human verification.** Extend [`agent-trace.test.ts`](../packages/library-chat/src/agent-trace.test.ts) and web panel tests with de-duplication, unknown parts, missing timestamps, redaction, and the platform/provider regression. Add iOS fixture-decoding, projection, ordering, and presentation tests. Run app checks and `pnpm test:mobile`. Verify long traces, VoiceOver, Dynamic Type, web keyboard navigation, personal Chat, and project Work.

**Dependencies and ADRs.** No new dependency. This is a read-only projection over durable history and is compatible with [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md). Persisting a new trace/event log or exposing provider telemetry would require separate architecture and privacy review.

## Explicit exclusions

- **Generic agent availability:** already represented by `unavailableSkillIds`, `unavailableToolIds`, and model availability in [`agentResponse.ts`](../apps/api/src/services/agents/agentResponse.ts) and the shared [agent schema](../packages/schemas/src/agents.ts). Deepen only when a concrete missing state is evidenced.
- **Generic tool-discovery redesign or OpenCode code mode:** Polychat already returns scope-aware readiness/setup facts through [`discover_capabilities`](../apps/api/src/services/functions/discover_capabilities.ts), activates exact server-approved names for the current response, and reapplies authority under [ADR 0029](skills/polychat-setup/references/architecture/decisions/0029-server-managed-tool-selection.md). OpenCode's terminal-oriented MCP code mode does not justify a second path.
- **OpenCode child-session agents:** Polychat's durable project flows already re-enter current workspace authority. A second background child-session runtime would conflict with [ADR 0026](skills/polychat-setup/references/architecture/decisions/0026-project-task-boards.md) and [ADR 0036](skills/polychat-setup/references/architecture/decisions/0036-agents-composed-from-platform-capabilities.md).
- **Streaming, progress, detachment, or replay work:** the semantic activity and continuity work belongs to the preceding goals. The [replay review](turn-continuity-measurement.md#replay-decision) retains persisted-answer polling under [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md); only representative evidence of user harm should reopen it.
- **Broad provider compatibility or retry redesign:** the comparison found the provider seam materially equivalent. Retry-header support may be reconsidered only after concrete rate-limit evidence; it is not a second-wave architecture goal on the current record.
