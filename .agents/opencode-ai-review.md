# OpenCode AI runtime comparison

> **Status:** working planning artefact, reviewed 5 September 2026. This is evidence for later planning, not canonical Polychat architecture and not an accepted decision.

> **Follow-through:** this comparison records the Polychat baseline before the ordered stream and continuity goals were applied later on 5 September 2026. The provider-neutral conformance corpus, semantic turn activity, web/iOS projections and continuity telemetry now address the streaming and progress candidates described below. See the [continuity measurement plan](turn-continuity-measurement.md) and [remaining second-wave goals](opencode-ai-next-goals.md); re-check current code before treating any deficiency as open.

## Review pin and method

The OpenCode baseline is the official `anomalyco/opencode` repository at commit [`5b1e31988ed74b821b3a7ca6647188446992aafc`](https://github.com/anomalyco/opencode/tree/5b1e31988ed74b821b3a7ca6647188446992aafc), committed 4 September 2026 with subject `sync release versions for v1.18.29`. `packages/opencode/package.json` identifies the release as `1.18.29`. All OpenCode links below are immutable links to that commit.

This review traced the current runtime from session entry, through prompt construction, model invocation, streamed message-part persistence, tool dispatch, MCP, retry and cancellation, into the desktop/web application reducers and timeline. It also inspected the unfinished next-generation runner in [`packages/core/src/session/runner/llm.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/core/src/session/runner/llm.ts). It does not treat that runner's TODOs as shipped behaviour. The behavioural baseline is `packages/opencode/src/**` plus the current `packages/app` consumer.

The Polychat evidence baseline is commit `e0dd1b094f31ea2680d2c28e1118e71abc8b6153` on 5 September 2026. Its accepted constraints come from [architecture context](skills/polychat-setup/references/architecture/context.md) and the linked ADRs. The comparison accounts for a structural difference: OpenCode is primarily a trusted, local coding-agent process; Polychat is a multi-user cloud product with personal and workspace authority shared by web and iOS. A useful local UX pattern is not automatically a safe cloud runtime pattern.

Verdicts mean:

- **Polychat ahead** — its current Module and Seam solve the problem more appropriately for Polychat's product constraints.
- **Equivalent** — materially similar user outcome, despite different implementation shape.
- **Adapt** — OpenCode demonstrates an idea that should deepen an existing Polychat Module without inventing a parallel Interface.
- **Reject** — adopting the OpenCode design would weaken an accepted Polychat decision or import the wrong runtime assumptions.

## Executive comparison

| Area                         | Verdict            | Evidence-led conclusion                                                                                                                                                                   |
| ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session orchestration        | **Polychat ahead** | Polychat separates durable turn ownership, transport and the agent loop; OpenCode's shipped loop remains process-local and concentrated in two large Modules.                             |
| Prompt and context assembly  | **Equivalent**     | Both layer system, user, project and runtime context. OpenCode's read-triggered nested instruction loading is useful only for Polychat's repository sandbox.                              |
| Compaction                   | **Adapt**          | OpenCode retains complete recent turns by token budget and recursively carries summaries; Polychat uses a fixed eight-message tail and truncates summary input from the oldest end.       |
| Agents                       | **Polychat ahead** | Polychat's saved agents and project flows re-enter server authority; OpenCode's child sessions are capable but inherit a local-process trust model.                                       |
| Permissions                  | **Reject**         | OpenCode's last-match rules and in-memory approvals are interaction safeguards, not durable multi-user authority. Polychat's exact approval receipts and scope revalidation are stronger. |
| MCP                          | **Adapt**          | OpenCode has a deeper transport/lifecycle Module. Polychat has concrete contract and exact-routing defects that can be fixed within its existing MCP Modules.                             |
| Tool discovery and execution | **Polychat ahead** | Polychat already has server-managed discovery with response-scoped activation and authority reapplication; OpenCode normally sends all tools and its code mode only compresses MCP tools. |
| Provider handling            | **Equivalent**     | OpenCode has broader compatibility transformation; Polychat has better Locality, account policy and provider governance seams.                                                            |
| Retries                      | **Adapt**          | Both retry centrally. OpenCode honours retry headers and publishes retry timing; Polychat makes one opaque retry with locally calculated delay.                                           |
| Cancellation                 | **Polychat ahead** | Polychat cancellation survives stream detachment; OpenCode propagates cancellation more directly through a single process. Polychat should close its tool-cancellation gap.               |
| Recovery                     | **Polychat ahead** | Web and iOS recover from persisted history while a Durable Object reports active work; OpenCode's shipped execution/status ownership is in memory.                                        |
| Tracing                      | **Adapt**          | OpenCode correlates model and tool spans through OpenTelemetry; Polychat has metrics and logs but no equivalent end-to-end trace context.                                                 |
| User-visible progress        | **Adapt**          | Polychat has a shared stream vocabulary and recovery UI, but native tool lifecycle events are synthesised only after model output is complete.                                            |

## 1. Session orchestration

**OpenCode files.** [`session/prompt.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/prompt.ts), [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/processor.ts), [`session/run-state.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/run-state.ts), [`session/status.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/status.ts), and the unfinished [`core session runner`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/core/src/session/runner/llm.ts).

**Polychat files.** [`ChatOrchestrator.ts`](../apps/api/src/lib/chat/core/ChatOrchestrator.ts), [`chat-stream.ts`](../apps/api/src/lib/chat/core/chat-stream.ts), [`agent-loop.ts`](../apps/api/src/lib/chat/agent/agent-loop.ts), [`turn-transport.ts`](../apps/api/src/lib/chat/agent/turn-transport.ts), [`ConversationCoordinator`](../apps/api/src/services/conversations/coordinator/object.ts), and its [client](../apps/api/src/services/conversations/coordinator/client.ts).

**User-visible problem.** A reply can span several model turns, tools, compaction and user pauses. It must not duplicate work, interleave two replies, disappear when a connection closes, or leave the conversation permanently busy.

**Polychat Module and Seam.** `lib/chat/core` owns request orchestration; `lib/chat/agent` owns the provider/tool loop; `ChatTurnTransport` isolates buffered and streamed provider I/O; the conversation coordinator owns per-thread admission. Routes compose these Modules rather than containing the state machine.

**Assessment — Polychat ahead.** OpenCode's `runLoop` is a competent local loop: it reloads persisted messages, handles subtask and compaction work, resolves agent/model/tools per iteration, and delegates streamed parts to `processor.ts`. Its `SessionRunState` nevertheless keeps the active runner and join promise in an in-memory map. The shipped `prompt.ts` and `processor.ts` are 1,631 and 732 lines respectively and receive a broad set of dependencies, reducing Locality. The new core runner explicitly lists durable ownership, stale-work handling, replayable output and recovery as future work. Polychat already separates these concerns and coordinates active work durably.

**Deficiency evidence.** No Polychat deficiency is claimed here. OpenCode's own next-runner TODO list is corroborating evidence that its shipped process-local ownership is not a model Polychat should copy.

**ADR fit.** The current shape implements [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md) and [ADR 0026](skills/polychat-setup/references/architecture/decisions/0026-project-task-boards.md). Folding orchestration back into a transport or route would conflict with both and with [ADR 0001](skills/polychat-setup/references/architecture/decisions/0001-overall-platform-architecture.md).

**Web and iOS.** Both clients benefit from the same server turn semantics and stored history. Neither should reproduce the loop locally; only WebLLM remains a deliberately local web path.

**Bounded candidate.** None. Preserve the current Module split. If `ChatOrchestrator` grows, extract cohesive preparation or finalisation Implementations behind existing Seams, without changing the wire contract.

## 2. Prompt and context assembly

**OpenCode files.** [`session/system.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/system.ts), [`session/instruction.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/instruction.ts), [`session/llm/request.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/llm/request.ts), and [`session/prompt.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/prompt.ts).

**Polychat files.** [`RequestPreparer.ts`](../apps/api/src/lib/chat/preparation/RequestPreparer.ts), [`system-prompt.ts`](../apps/api/src/lib/chat/preparation/system-prompt.ts), [`provider-context.ts`](../apps/api/src/lib/chat/preparation/provider-context.ts), [`project chat context`](../apps/api/src/services/workspaces/chatContext.ts), and [`skill scope`](../apps/api/src/services/skills/scope.ts).

**User-visible problem.** The model needs the right instructions, memories, project context, attachments, goal and available skills without leaking another user's or workspace's data or overflowing the model window.

**Polychat Module and Seam.** Request preparation constructs sanitised messages, authorised workspace context, memory policy, skills and the generated system prompt. Provider context restores permitted attachments and prunes the final message set. Saved persona and goal layers enter through the same preparation pipeline.

**Assessment — Equivalent.** OpenCode chooses model-family system prompts, adds environment and directory metadata, discovers repository instructions, and allows plugins to transform the final system array. Its distinctive useful behaviour is delayed nested-instruction loading: after a file read, it walks from that file towards the project root and attaches previously unseen instruction files. Polychat is stronger at server-owned user/workspace scope; OpenCode is stronger at repository-local instruction discovery because that is central to a coding agent.

**Deficiency evidence.** Polychat's prompt builder appends project instructions, goals, memory and skills, but the repository sandbox prompt path has no corresponding read-triggered instruction search in the inspected preparation or sandbox Modules. That is only a deficiency for coding runs that traverse repositories; it is not a general chat deficiency.

**ADR fit.** Applying filesystem discovery to normal Chat or Work would conflict with the explicit scoped-resource posture in [ADR 0009](skills/polychat-setup/references/architecture/decisions/0009-canonical-workspace-resources.md). Limiting it to an already-authorised sandbox checkout is compatible with [ADR 0032](skills/polychat-setup/references/architecture/decisions/0032-version-authored-skills-with-d1-state-and-r2-bundles.md) and [ADR 0036](skills/polychat-setup/references/architecture/decisions/0036-agents-composed-from-platform-capabilities.md), provided loaded instructions remain subordinate to platform and workspace policy.

**Web and iOS.** This is server/sandbox behaviour. Clients need no new controls; any loaded instruction provenance should appear through existing sandbox run detail rather than a new chat-only representation.

**Bounded candidate.** For sandbox coding runs only, examine authorised repository reads for existing instruction filenames already recognised by the sandbox, load the nearest applicable file once per run, and record it in existing run provenance. Do not scan outside the checked-out root or add instruction discovery to ordinary Chat.

## 3. Compaction

**OpenCode files.** [`session/compaction.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/compaction.ts), [`session/message-v2.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/message-v2.ts), and [`session/prompt.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/prompt.ts).

**Polychat files.** [`compaction.ts`](../apps/api/src/lib/session/compaction.ts), [`SessionManager.ts`](../apps/api/src/lib/session/SessionManager.ts), [`context-window.ts`](../apps/api/src/lib/chat/policy/context-window.ts), [`compaction-stream.ts`](../apps/api/src/lib/chat/core/compaction-stream.ts), and [compaction tests](../apps/api/src/lib/session/__test__/compaction.test.ts).

**User-visible problem.** Long conversations must remain coherent and continue within provider limits while preserving recent tool/user causality and making any lossy rewrite visible.

**Polychat Module and Seam.** `SessionManager.compact` delegates selection to `buildCompactionPlan`, summarises through an auxiliary model, persists a snapshot and marker under the thread coordinator, and returns the compacted active history. The event Adapter exposes the persisted marker to web and iOS.

**Assessment — Adapt.** Polychat already triggers on estimated token pressure, persists compaction transactionally enough to clean up inserted markers on archive failure, and has user-visible compaction state. OpenCode's selection has greater Depth: it retains complete recent turns to a token budget, carries a prior completed compaction summary into the next summary, serialises reasoning and tool inputs/results deliberately, prunes old large tool output separately, strips media on overflow replay, and resumes automatically.

**Deficiency evidence.** Polychat's automatic plan uses `DEFAULT_KEEP_RECENT_MESSAGES = 8` and slices by message count, so a tool call and its result can be split at the archive boundary. `formatMessagesForSummary` iterates from the oldest archived message until its fixed 16,000-character budget is exhausted, so the newest archived facts can be omitted from the summary input. `buildFallbackSummary` then keeps only the last six messages. The tests explicitly assert the fixed eight-message tail. OpenCode's turn-aware token tail directly avoids the first two failure modes.

**ADR fit.** Deepening selection and summary input inside the current Module is compatible with [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md). Auto-continuing through a synthetic user message should be rejected unless it preserves the existing persisted turn model; opaque provider-only history would conflict with that ADR.

**Web and iOS.** Keep the existing compaction message and `state: compaction` contract so both clients continue to render the same event. Selection changes are server-only but should be tested against both clients' stored snapshot assumptions.

**Bounded candidate.** Change only `buildCompactionPlan` and summary formatting: choose the retained tail backwards by estimated token budget at user-turn boundaries; include the previous active snapshot in the next summary; fill a bounded summary input from the newest archived turns while preserving chronological output. Extend the existing compaction suites. Keep `SessionManager`'s Interface and wire marker unchanged.

## 4. Agents

**OpenCode files.** [`agent/agent.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/agent/agent.ts), [`agent/subagent-permissions.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/agent/subagent-permissions.ts), and [`tool/task.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/tool/task.ts).

**Polychat files.** [`agent completion request`](../apps/api/src/services/agents/completion-request.ts), [`agent response`](../apps/api/src/services/agents/agentResponse.ts), [`project task flow`](../apps/api/src/services/project-tasks/flow.ts), [`project task runner`](../apps/api/src/services/project-tasks/runner.ts), [`task executor`](../apps/api/src/services/tasks/TaskExecutor.ts), and [agent schemas](../packages/schemas/src/agents.ts).

**User-visible problem.** Users need reusable specialist behaviour and delegated long-running work without losing model/tool restrictions, workspace authority, progress or resumability.

**Polychat Module and Seam.** Saved agents resolve persona, model, skills and explicit tools into the same chat engine. Project task flows persist durable sequencing and the runner re-resolves workspace membership and runtime authority.

**Assessment — Polychat ahead.** OpenCode has concise built-in primary/subagent profiles, depth limits, resumable child session IDs, background completion notification and child-tree cancellation. Those features suit a local coding process. Polychat's durable project flows and re-entry through current server authority solve the harder multi-user problem and avoid a separate agent runtime.

**Deficiency evidence.** No general Polychat deficiency is claimed. OpenCode's `subagent-permissions.ts` intentionally inherits only selected parent-session deny rules while the child's own profile dominates; copying that rule would be unsafe for workspace operations where current server scope must dominate every execution.

**ADR fit.** OpenCode-style nested background child sessions would conflict with [ADR 0026](skills/polychat-setup/references/architecture/decisions/0026-project-task-boards.md) if introduced as a second durable runtime. Agent-requested tools, skills and models must remain subordinate to executing scope under [ADR 0036](skills/polychat-setup/references/architecture/decisions/0036-agents-composed-from-platform-capabilities.md).

**Web and iOS.** Both clients should continue to observe saved agents and project tasks through shared resources and stored chat history. A desktop-only subagent tree UI would create product divergence.

**Bounded candidate.** None. Reject a second child-session orchestration layer. If task delegation needs depth limits or parent/child presentation, add those fields to the existing durable project-flow model only after a concrete product case and schema review.

## 5. Permissions

**OpenCode files.** [`permission/index.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/permission/index.ts), [`agent/agent.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/agent/agent.ts), and [`session/tools.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/tools.ts).

**Polychat files.** [`tool execution`](../apps/api/src/lib/chat/tools/execution.ts), [`PermissionChecker`](../apps/api/src/lib/permissions/PermissionChecker.ts), [`connector approval receipts`](../apps/api/src/services/apps/connectors/operation-approvals.ts), [`connector operations`](../apps/api/src/services/apps/connectors/operations.ts), and [`workspace chat context`](../apps/api/src/services/workspaces/chatContext.ts).

**User-visible problem.** The assistant must explain and pause before consequential actions, remember only the approval the user actually gave, and refuse work outside current account/workspace authority.

**Polychat Module and Seam.** Tool permission checks run at execution. Connector approvals persist the exact account, operation and argument digest, then are claimed after current authority and input are revalidated. Workspace context intersects configured tools with current membership.

**Assessment — Reject.** OpenCode evaluates ordered wildcard rules with last match winning, publishes an approval request, and stores `always` approvals in process memory. This is a useful local interaction guard, but it is not a durable authority record and is not safe for a multi-user Worker deployment. Polychat is materially ahead for consequential external work.

**Deficiency evidence.** No Polychat deficiency is claimed. In OpenCode, pending approvals and the accumulated `approved` rules are held in maps in `permission/index.ts`; process restart loses them. Tool hiding considers only wildcard-denied tools, while fine-grained rules are checked at execution. Those are acceptable UX choices for a local agent, not transferable security properties.

**ADR fit.** Replacing exact durable receipts with wildcard or session-memory approval conflicts directly with [ADR 0013](skills/polychat-setup/references/architecture/decisions/0013-composio-run-approval-and-event-boundaries.md), and allowing agent configuration to grant authority conflicts with [ADR 0009](skills/polychat-setup/references/architecture/decisions/0009-canonical-workspace-resources.md).

**Web and iOS.** Keep approval records server-owned and render the same pending interaction on both clients. Never make one client's local approval cache authoritative.

**Bounded candidate.** None. Reuse only presentation ideas, such as clearer path/command previews for sandbox actions, through the existing pending interaction representation. Do not adopt OpenCode's permission store or matching semantics.

## 6. MCP

**OpenCode files.** [`mcp/index.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/mcp/index.ts), [`mcp/catalog.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/mcp/catalog.ts), [`session/tools.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/tools.ts), and [`tool/code-mode.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/tool/code-mode.ts).

**Polychat files.** [MCP schema](../packages/schemas/src/agents.ts), [`agents/mcp-client.ts`](../apps/api/src/services/agents/mcp-client.ts), [`agents/completion-tools.ts`](../apps/api/src/services/agents/completion-tools.ts), [`functions/mcp.ts`](../apps/api/src/services/functions/mcp.ts), and [MCP tests](../apps/api/src/services/functions/__test__/mcp.test.ts).

**User-visible problem.** A saved agent should connect to the intended MCP server, show why a server is unavailable, discover only usable capabilities, call the exact server/tool pair, stop hanging calls and release connections.

**Polychat Module and Seam.** Saved-agent completion constructs request-scoped MCP clients; discovered definitions enter the normal function registry; execution resolves the registered client through request context; `chat-stream` disposes every client at turn end. This request Locality is good and prevents concurrent turns sharing live sessions.

**Assessment — Adapt.** OpenCode supports local stdio, Streamable HTTP with SSE fallback, OAuth discovery and callback state, connection statuses, prompts/resources/templates, pagination guards, `tools/list_changed`, progress-aware timeouts and shutdown. Polychat should not copy local stdio into Workers, but it should adapt exact server identity and user-visible lifecycle status.

**Deficiency evidence.** There are four concrete gaps:

- The shared `mcpServerSchema` accepts `type: "stdio"` plus `command` and `args`, but `connectMCPServerReady` explicitly returns `Stdio MCP servers are not supported in this runtime`; its local parser also discards `command` and `args`.
- Discovered tool names are `mcp_<first-eight-agent-id>_<tool-name>` and contain no server identity. Execution tries to infer a connection from the tool-name prefix and otherwise deliberately uses the first available connection. Duplicate tool names or multiple servers can therefore target the wrong server.
- `completion-tools.ts` catches connection/discovery failures, logs them, and returns the remaining tools. The user receives no server status or authentication action.
- The inspected Polychat MCP runtime exposes tools only; it contains no resource, prompt/template, OAuth or list-change handling comparable to OpenCode's MCP Module.

**ADR fit.** Exact server/tool routing reinforces [ADR 0013](skills/polychat-setup/references/architecture/decisions/0013-composio-run-approval-and-event-boundaries.md)'s exact-operation principle and [ADR 0036](skills/polychat-setup/references/architecture/decisions/0036-agents-composed-from-platform-capabilities.md)'s execution-time authority checks. Adding local stdio to the API Worker would conflict with the deployment boundary in [ADR 0001](skills/polychat-setup/references/architecture/decisions/0001-overall-platform-architecture.md). MCP OAuth must not bypass connector/account authority.

**Web and iOS.** Configuration and status are shared product data, so both clients need the same supported transport vocabulary and unavailable/authentication state. Do not expose a transport option on iOS or web that the API cannot execute. Exact routing is server-only and immediately benefits both.

**Bounded candidate.** First, align the existing schema with Worker reality: remove `stdio`, `command` and `args`, and admit only the remote transports the client manager executes. Then encode the stable MCP server ID in each existing tool name/definition, parse it at execution, require an exact connection and remove fuzzy tool matching and first-connection fallback. Add multi-server duplicate-name and unsupported-transport tests. Treat OAuth/resources/prompts as separate product candidates, not part of this fix.

## 7. Tool discovery and execution

**OpenCode files.** [`tool/registry.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/tool/registry.ts), [`session/tools.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/tools.ts), [`tool/code-mode.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/tool/code-mode.ts), and [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/processor.ts).

**Polychat files.** [`functions/index.ts`](../apps/api/src/services/functions/index.ts), [`functions/availability.ts`](../apps/api/src/services/functions/availability.ts), [`discover_capabilities.ts`](../apps/api/src/services/functions/discover_capabilities.ts), [`assistant-capability-discovery-sources.ts`](../apps/api/src/services/assistant-capability-discovery-sources.ts), [`capability-activation.ts`](../apps/api/src/lib/chat/tools/capability-activation.ts), and [`tool execution`](../apps/api/src/lib/chat/tools/execution.ts).

**User-visible problem.** The model must find an appropriate tool without paying for every schema on every turn, then execute only a currently allowed capability with repeat protection and understandable failures.

**Polychat Module and Seam.** `managed` selection supplies a small baseline including `discover_capabilities`; discovery reads server-owned eligible sources; successful discovery activates named tools only for the current response; the loop updates its enabled set; execution reapplies permission and approval policy. `explicit` selection remains authoritative for saved agents and callers.

**Assessment — Polychat ahead.** OpenCode's normal mode builds a broad per-model registry and includes every configured MCP tool. Its experimental code mode compresses MCP invocation behind one `execute` tool, but still embeds the MCP catalogue in that tool's description and does not discover native tools. Polychat's response-scoped activation is deeper: it reduces prompt load while retaining exact server eligibility and works for more than MCP.

**Deficiency evidence.** No Polychat deficiency is claimed in discovery. Polychat also has deterministic repeated-call protection in the tool call ledger and one-turn recovery for unknown capability calls. OpenCode's three-identical-call `doom_loop` approval is a useful local escape hatch but should not replace those deterministic limits.

**ADR fit.** The current implementation follows [ADR 0029](skills/polychat-setup/references/architecture/decisions/0029-server-managed-tool-selection.md). Loading an ungoverned orchestration script or permitting discovery to grant authority would conflict with it. A code-execution dispatcher belongs, if anywhere, behind the sandbox Worker and its own policy.

**Web and iOS.** Both clients receive the same tools and results without owning the catalogue. Keep discovery invisible unless it yields useful progress; do not require client-specific tool registries.

**Bounded candidate.** None for discovery. Reject OpenCode code mode in the main chat runtime. Continue to deepen `discover_capabilities` sources and tests within its existing Interface as concrete capability families are added.

## 8. Provider handling

**OpenCode files.** [`provider/provider.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/provider/provider.ts), [`provider/transform.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/provider/transform.ts), [`session/llm.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/llm.ts), and [`session/llm/request.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/llm/request.ts).

**Polychat files.** [`ProviderRegistry.ts`](../apps/api/src/lib/providers/registry/ProviderRegistry.ts), [`chat registrations`](../apps/api/src/lib/providers/registry/registrations/chat.ts), [`BaseProvider`](../apps/api/src/lib/providers/capabilities/chat/providers/base.ts), [`model policy`](../apps/api/src/lib/providers/models/policy.ts), [`model access`](../apps/api/src/lib/chat/policy/model-access.ts), [`responses.ts`](../apps/api/src/lib/chat/streaming/responses.ts), and [`provider-stream.ts`](../apps/api/src/lib/chat/agent/provider-stream.ts).

**User-visible problem.** A selected model must actually be executable for the account, use the right credential authority, translate messages/tools correctly, stream consistently, report usage and preserve provider-specific features without contaminating every other provider.

**Polychat Module and Seam.** A category registry resolves provider Implementations. Server-owned model policy projects active/selectable models per account and chooses platform or BYOK credentials. `BaseProvider` contains common request mechanics; provider Modules own deviations; turn transport and stream parsing normalise output for the agent loop.

**Assessment — Equivalent.** OpenCode has impressive compatibility breadth: dynamic provider loading, model catalogue matching, AI SDK and native-LLM fallback, tool schema repair, provider-option transformations and many provider/model-specific quirks. Polychat has materially better Locality—the comparable logic is split by provider and capability—and stronger product governance through account executable projections and credential authority.

**Deficiency evidence.** No direct feature deficiency is claimed. OpenCode's breadth is concentrated in 2,068-line `provider.ts` and 1,906-line `transform.ts`; copying those central switchboards would make Polychat shallower. Conversely, Polychat's accepted model lifecycle and provider governance designs are not fully implemented, as their ADR statuses state.

**ADR fit.** Centralising model quirks into a large universal transformer would conflict with [ADR 0001](skills/polychat-setup/references/architecture/decisions/0001-overall-platform-architecture.md). Provider work should advance [ADR 0030](skills/polychat-setup/references/architecture/decisions/0030-server-owned-model-selection-policy.md), [ADR 0038](skills/polychat-setup/references/architecture/decisions/0038-provider-surface-model-lifecycle.md) and [ADR 0040](skills/polychat-setup/references/architecture/decisions/0040-provider-execution-governance-policy.md), not create a parallel catalogue.

**Web and iOS.** Server-owned executable model responses must remain the common source for selectors and repair on both clients. Provider quirks should terminate at the API normalisation Seam.

**Bounded candidate.** Use OpenCode's transformation cases as a review corpus when implementing ADR 0038/0040: add only confirmed provider/model regressions to the owning Polychat provider's existing tests. Do not port `provider.ts`, `transform.ts`, its dynamic SDK loader or a second model catalogue.

## 9. Retries

**OpenCode files.** [`session/retry.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/retry.ts), [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/processor.ts), and [`session/status.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/status.ts).

**Polychat files.** [`responses.ts`](../apps/api/src/lib/chat/streaming/responses.ts), [`retries.ts`](../apps/api/src/utils/retries.ts), [`providerErrors.ts`](../apps/api/src/utils/providerErrors.ts), [`fetch.ts`](../apps/api/src/lib/providers/lib/fetch.ts), and [`chat-stream.ts`](../apps/api/src/lib/chat/core/chat-stream.ts).

**User-visible problem.** Brief provider overload or network failure should recover without duplicate tools or a mysterious frozen reply, while invalid input, context overflow and authentication failures should fail promptly.

**Polychat Module and Seam.** `getAIResponse` wraps provider invocation in shared `withRetry`, classifies retryable provider/network errors centrally and currently allows one retry. AI Gateway request headers form a second provider-side retry Seam for supported providers.

**Assessment — Adapt.** Both implementations classify retryable failures and use exponential jitter. OpenCode additionally parses `retry-after-ms`, numeric/date `retry-after`, caps backoff at 30 seconds, distinguishes account/free-limit actions, publishes retry attempt/message/action/next time, and settles retry state when execution resumes. Polychat's simpler single retry is a reasonable default, but it is opaque and can disregard the provider's requested delay.

**Deficiency evidence.** Polychat's `withRetry` calculates delay only from `baseDelayMs * 2**attempt` plus jitter; it receives no response headers or cancellation signal. `responses.ts` logs `attempt` and `delayMs` in `onRetry` but writes no stream event. `fetchAIResponse` extracts provider request IDs but does not retain retry headers in `AssistantError` context. `BaseProvider.getFetchOptions` passes only `requestTimeout`, so the default AI Gateway retry option object is replaced and its retry fields are normally omitted; the outer one-retry loop remains the reliable behaviour.

**ADR fit.** Retrying only before any provider output is compatible with [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md). Replaying a partially streamed turn or re-executing an uncertain tool result would conflict with that ADR and [ADR 0013](skills/polychat-setup/references/architecture/decisions/0013-composio-run-approval-and-event-boundaries.md).

**Web and iOS.** A shared retry state would let both clients show “provider busy; retrying” rather than a generic spinner. It belongs in `packages/schemas` before either parser changes. Client disconnect/recovery must not start another model attempt.

**Bounded candidate.** Extend the existing provider error context to retain validated `Retry-After` timing and let `withRetry` choose the bounded greater of policy delay and provider delay, with an abortable wait. Emit retry progress through the existing `state` envelope and add the value to both existing state parsers only if the product chooses visible retry UX. Keep one retry initially; do not retry after streamed content or any tool execution.

## 10. Cancellation

**OpenCode files.** [`session/run-state.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/run-state.ts), [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/processor.ts), [`session/llm.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/llm.ts), and [`tool/task.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/tool/task.ts).

**Polychat files.** [`turn-cancellation.ts`](../apps/api/src/lib/chat/streaming/turn-cancellation.ts), [`chat-stream.ts`](../apps/api/src/lib/chat/core/chat-stream.ts), [`provider-stream.ts`](../apps/api/src/lib/chat/agent/provider-stream.ts), [`tool execution`](../apps/api/src/lib/chat/tools/execution.ts), [`useStreamingResponse.ts`](../apps/app/src/hooks/useStreamingResponse.ts), and [`APIClient.swift`](../apps/mobile/ios/Polychat/Services/APIClient.swift).

**User-visible problem.** Stop must end expensive work promptly, prevent further tools, preserve useful partial output where safe, and behave consistently after the network stream has detached.

**Polychat Module and Seam.** Clients abort their local stream and call the cancellation endpoint. The API records a short-lived cancellation flag in KV; detached turns poll it; provider stream consumption cancels its reader and returns a stopped result. `waitUntil` keeps finalisation alive after disconnect.

**Assessment — Polychat ahead.** OpenCode directly interrupts the local Effect runner, aborts the model stream, cancels background child sessions and settles running tool parts as aborted. That has lower in-process latency. Polychat solves the harder detached-Worker case and does not equate connection loss with cancellation.

**Deficiency evidence.** Polychat's stop check is consulted in `consumeProviderStream`, but `handleToolCalls` and normal function handlers receive no turn `AbortSignal` or `shouldStop` callback. A cancellation arriving during a long native tool call can therefore take effect only after that call returns. MCP has its own 30-second `AbortSignal.timeout`, but it is not linked to user cancellation. OpenCode passes its abort signal into model and tool execution and cancels child work.

**ADR fit.** Propagating cancellation through existing execution context advances [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md). Treating SSE disconnect as cancellation would directly conflict with it. Cancellation must not turn an uncertain external action into an automatic retry under [ADR 0013](skills/polychat-setup/references/architecture/decisions/0013-composio-run-approval-and-event-boundaries.md).

**Web and iOS.** Both already initiate cancellation. Server-side propagation improves both without a wire change. UI should continue to distinguish stopped partial output from transport recovery.

**Bounded candidate.** Add one run-scoped `AbortController` in `chat-stream`, trigger it when the existing stop watcher observes cancellation, and pass its signal through the existing tool request context to handlers that support cancellation. Link MCP timeout and run signals with `AbortSignal.any`. Add an integration test proving a cancellable tool stops and no later tool begins. Do not promise hard cancellation for external systems that have already accepted a request.

## 11. Recovery

**OpenCode files.** [`session/run-state.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/run-state.ts), [`session/status.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/status.ts), [`app/context/server-session.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/app/src/context/server-session.ts), and the unfinished [`core runner`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/core/src/session/runner/llm.ts).

**Polychat files.** [`chat-stream.ts`](../apps/api/src/lib/chat/core/chat-stream.ts), [`ConversationCoordinator`](../apps/api/src/services/conversations/coordinator/object.ts), [`getChatCompletion.ts`](../apps/api/src/services/completions/getChatCompletion.ts), [`turn-recovery.ts`](../apps/app/src/lib/chat/turn-recovery.ts), [`useStreamingResponse.ts`](../apps/app/src/hooks/useStreamingResponse.ts), [`TurnRecovery.swift`](../apps/mobile/ios/Polychat/Services/TurnRecovery.swift), and [`ConversationManager.swift`](../apps/mobile/ios/Polychat/Services/ConversationManager.swift).

**User-visible problem.** When Wi-Fi changes, the app backgrounds, a tab closes or an event connection fails, the user should recover the completed answer rather than unknowingly submit it again.

**Polychat Module and Seam.** The server persists messages while the coordinator reports an active operation. Web and iOS independently poll stored history for new non-user messages for up to three minutes and show a reconnecting state. The active-operation field lets remote views show work still in progress.

**Assessment — Polychat ahead.** OpenCode persists message parts and its application reconnects/buffers events and backfills data, which is strong local client recovery. The actual runner and status ownership in the shipped runtime are in-memory, so a process restart cannot resume in-flight execution. Its new core runner explicitly labels durable continuation recovery a future slice. Polychat deliberately promises best-effort completion plus durable history recovery, not exact event replay.

**Deficiency evidence.** No Polychat deficiency is claimed against its accepted guarantee. The five-minute coordinator lease and three-minute client recovery window are bounded operational trade-offs, not full workflow durability.

**ADR fit.** Current behaviour implements [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md). Importing OpenCode's event log/reducer as a demand for replayable output would exceed and potentially conflict with the accepted best-effort model. Truly durable multi-step project work remains in [ADR 0026](skills/polychat-setup/references/architecture/decisions/0026-project-task-boards.md).

**Web and iOS.** This is already deliberately symmetric: both poll the same stored conversation and preserve the partial/reconnecting presentation. Keep recovery policy values aligned and tested on both surfaces.

**Bounded candidate.** None from OpenCode. Continue validating the existing recovery contract. If users report failures outside the three-minute window, adjust the shared operational policy deliberately rather than adding event replay.

## 12. Tracing

**OpenCode files.** [`session/llm.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/llm.ts), [`session/tools.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/tools.ts), [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/processor.ts), and [`effect/runner.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/effect/runner.ts).

**Polychat files.** [`monitoring`](../apps/api/src/lib/monitoring.ts), [`BaseProvider`](../apps/api/src/lib/providers/capabilities/chat/providers/base.ts), [`responses.ts`](../apps/api/src/lib/chat/streaming/responses.ts), [`chat-stream.ts`](../apps/api/src/lib/chat/core/chat-stream.ts), [`agent-loop.ts`](../apps/api/src/lib/chat/agent/agent-loop.ts), and [`logger.ts`](../apps/api/src/utils/logger.ts).

**User-visible problem.** When a reply is slow, costly or fails after a tool call, operators need to reconstruct the exact model turn and tool path without exposing prompts, credentials or private output in logs.

**Polychat Module and Seam.** Provider Implementations are wrapped by `trackProviderMetrics`; AI Gateway/provider request identifiers can be captured in responses; Modules use prefixed structured logging and pass `completionId` through core execution.

**Assessment — Adapt.** OpenCode names Effect spans across runtime operations, emits a `Tool.execute` span with session/message/call/tool identifiers, enables AI SDK OpenTelemetry for model calls and injects session identity into proxy metadata. Polychat has useful metrics and logs but lacks the same causal trace across orchestration, model attempts and tool calls.

**Deficiency evidence.** Searches of Polychat chat/provider/agent/function Modules find structured logger calls and analytics, but no span creation or trace/span ID propagation. Several logs include `completionId`, while others log only tool name or provider. `log_id` is provider-response data rather than a Polychat-owned end-to-end trace. Consequently, an operator must correlate separate logs heuristically.

**ADR fit.** Correlation at existing Module Seams is compatible with [ADR 0001](skills/polychat-setup/references/architecture/decisions/0001-overall-platform-architecture.md). Recording prompts, raw tool arguments, credentials or cross-workspace identity in traces would conflict with scoped authority and security expectations in [ADR 0009](skills/polychat-setup/references/architecture/decisions/0009-canonical-workspace-resources.md).

**Web and iOS.** Tracing is primarily operational. A safe opaque support/reference ID may be surfaced on terminal errors to both clients, but clients should not receive trace payloads or provider secrets.

**Bounded candidate.** Before adding a dependency, standardise existing structured log fields at three Seams: turn start/end, each provider attempt and each tool start/end. Carry `completionId`, a generated turn-attempt ID, tool-call ID, provider/model, duration and outcome; explicitly exclude prompt/tool content. Use Cloudflare-native trace context if already available. Measure whether this resolves incident correlation before considering OpenTelemetry.

## 13. User-visible progress

**OpenCode files.** [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/processor.ts), [`session/status.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/opencode/src/session/status.ts), [`app/context/server-session.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/app/src/context/server-session.ts), [`message-timeline.tsx`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/app/src/pages/session/timeline/message-timeline.tsx), and [`timeline/rows.ts`](https://github.com/anomalyco/opencode/blob/5b1e31988ed74b821b3a7ca6647188446992aafc/packages/app/src/pages/session/timeline/rows.ts).

**Polychat files.** [`emitter.ts`](../apps/api/src/lib/chat/streaming/emitter.ts), [`provider-stream.ts`](../apps/api/src/lib/chat/agent/provider-stream.ts), [`agent-loop.ts`](../apps/api/src/lib/chat/agent/agent-loop.ts), [`stream-state.ts`](../apps/app/src/lib/chat/stream-state.ts), [`streamActivityStore.ts`](../apps/app/src/state/stores/streamActivityStore.ts), [`ChatStreamEventParser.swift`](../apps/mobile/ios/Polychat/Utilities/ChatStreamEventParser.swift), and [`StreamingToolActivity.swift`](../apps/mobile/ios/Polychat/Utilities/StreamingToolActivity.swift).

**User-visible problem.** Long work needs truthful signs of life: thinking, tool input, tool running/completed/error, retry, compaction, waiting for approval, reconnection and completion. Progress must not imply an action happened before it did.

**Polychat Module and Seam.** The server's event sink emits a shared SSE vocabulary for state, text/thinking, tool use/results, usage and errors. Web coalesces deltas into stream activity; iOS parses the same event names and builds tool activity. Persisted messages remain the recovery source of truth.

**Assessment — Adapt.** Polychat is stronger on cross-client recovery and already exposes thinking, post-processing, compaction and pending interactions. OpenCode maintains richer live tool-part states (`pending`, `running`, `completed`, `error`), persists deltas incrementally, displays retry timing and settles interrupted tools explicitly. The key transferable idea is to align event timing with actual execution.

**Deficiency evidence.** In Polychat, `runAgentLoop.resolveTurn` waits for `transport.runTurn` to return the complete tool-call array. `executeToolCalls` then calls `emitToolCallEvents`, which emits `tool_use_start`, the entire arguments string as one `tool_use_delta`, and `tool_use_stop` back-to-back before calling `handleToolCalls`. Users therefore cannot see native tool input assemble during provider streaming, and the “stop” event denotes input completion rather than tool completion. Results stream individually, but there is no generic start/running state for the actual tool execution. Retry progress is only logged, as described above.

**ADR fit.** Improving event timing is compatible with [ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md) so long as persisted messages remain authoritative and no exact replay guarantee is implied. Any new event fields must originate in `packages/schemas` under [ADR 0001](skills/polychat-setup/references/architecture/decisions/0001-overall-platform-architecture.md).

**Web and iOS.** Both parsers already understand tool-use and tool-response events. Moving existing events earlier is mostly server-side, but both activity reducers need regression tests for interleaved parallel calls, cancellation and missing terminal events. Visible retry requires coordinated schema/parser work on both.

**Bounded candidate.** First, emit existing `tool_use_*` events from `provider-stream.ts` as provider deltas arrive, using its existing partial-tool-call accumulator; remove the post-turn synthetic replay. Emit an existing `state` update immediately before each actual tool execution and rely on the existing `tool_response` for completion, unless product design proves a new event is necessary. Add web and iOS parser/activity tests for two interleaved tools, a cancelled tool and a failed tool.

## Prioritised bounded candidates

These are planning candidates, not approved work:

1. **Correct MCP identity and contract.** Remove unsupported stdio configuration, carry server identity in tool names and require exact routing. This fixes a demonstrable wrong-target risk with a narrow schema/runtime/test change.
2. **Make compaction turn-aware.** Retain recent complete turns by token budget and preserve the newest archived facts in summary input, behind the existing `SessionManager` Interface.
3. **Propagate cancellation into tools.** Link the existing detached-turn cancellation signal to cancellable tool and MCP execution so Stop is truthful during long calls.
4. **Stream truthful native-tool progress.** Move existing tool input events to provider parsing and align execution state with actual timing across web and iOS.
5. **Honour provider retry timing.** Preserve validated retry headers, make waits abortable and optionally expose a shared retry state; never replay partial output or uncertain actions.
6. **Add safe turn correlation.** Standardise identifiers and outcomes across current logs/metrics before considering a tracing dependency.
7. **Evaluate repository-local instructions only in sandbox runs.** Keep the experiment inside authorised checkouts and existing provenance.

## Ideas to reject explicitly

- Do not replace exact, durable approvals with OpenCode's in-memory wildcard permission store.
- Do not introduce a second child-session runtime for agent delegation; deepen existing project flows.
- Do not put all provider quirks into a central transformation switchboard or create a second model catalogue.
- Do not expose local stdio MCP from a Cloudflare Worker or silently route a tool to the first MCP connection.
- Do not introduce main-runtime code mode as an authority shortcut; discovery must never grant execution rights.
- Do not equate SSE disconnect with cancellation, replay partial provider output, automatically repeat uncertain tool calls, or promise exact event replay.

## Validation record

- OpenCode was cloned from `https://github.com/anomalyco/opencode`, detached at the full revision above, and `git rev-parse HEAD` matched it exactly.
- The OpenCode release version and commit metadata were read from that detached checkout.
- All relative Markdown links in this file are intended to resolve from `.agents/`; validate them after every edit.
- No product code, schema, ADR or canonical architecture document was changed as part of this review.
