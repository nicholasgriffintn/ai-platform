# ADR 0030: Sandbox-backed project task runners

## Status

Accepted

## Context

ADR 0026 made a project task the durable unit of agent work and shipped its first runner as an ordinary project conversation turn. That runner is the right fit for work performed through Polychat tools, but it cannot provide the isolated filesystem, repository checkout, language toolchain, or deterministic compiler evidence needed for repository-native work.

Lean proof work exposes the distinction clearly. The model must edit an authorised checkout, receive Lean compiler feedback over a long run, and leave a structured result that another project member can review. Treating that work as a hidden nested sandbox tool inside a conversation would create two layers of goals, budgets, approvals, cancellation, and retry state, while treating the sandbox as another chat pipeline would conflict with ADR 0022.

## Decision

Extend the project-task runner contract as a discriminated union. The existing `conversation` runner continues through `handleCreateChatCompletions` and the one turn engine from ADR 0022; the new `sandbox` runner names a bounded profile, initially `lean-proof`, and executes asynchronously through the sandbox dispatch system.

A sandbox-backed task has runner-specific anchors in addition to the project-task dispatch identity:

- `dispatchTaskId` identifies the exact internal task delivery;
- `runnerIdentityUserId` identifies the member whose authority starts the run;
- `sandboxRunId` identifies the isolated execution and activity record;
- `goalId` identifies the goal owned by that sandbox run;
- `outputId` identifies the durable project result after terminal projection.

The project-task queue handler claims the exact task, project, runner identity, and dispatch tuple, creates and attaches the sandbox run and goal, then returns after enqueueing the sandbox dispatch. The sandbox dispatcher owns execution. Its terminal projector updates the task only when the stored activity, immutable run payload, queue message, project-task context, goal owner, and every anchor still agree.

Terminal projection is exact and idempotent. A repeated terminal delivery returns the existing projection; stale or mismatched deliveries do nothing. A successful `compiled` or `kernel_checked` result creates one `lean.proof` project output and one pending human-review completion, an `incomplete` result blocks the task with `verification_failed`, execution failure blocks it with `run_failed`, and cancellation cancels it. Only a person accepts a reviewed result as done.

Keep sandbox authority server-owned. The caller supplies the proof objective, repository-relative Lean targets, optional declarations, acceptance criteria, and token budget. The API revalidates project membership, capability enablement, Pro access, current runner identity, and that identity's GitHub authority, then derives the repository and installation from the project's coding environment and fixes the model to `labs-leanstral-1-5`. A client cannot replace those values or start a Lean proof through the generic sandbox endpoint.

Publish Lean Proofs only in project scope. It is a Work experience backed by project tasks and project outputs; personal Chat does not receive the catalogue entry. The native iOS app has no Lean Proofs launch or management surface in this decision, and the training Worker is not involved.

Run Lean proofs in a dedicated `LeanSandbox` container built from `Dockerfile.lean` on Cloudflare `standard-3`. Keep the generic coding runner on its existing basic container. The Lean image pins uv, Python, elan, and `lean-lsp-mcp`; the checked-in `lean-toolchain` and Lake project remain the repository's toolchain authority.

Restrict the model to bounded proof tools. It may read or search only the requested targets, replace one exact source block at a time, request read-only Lean LSP diagnostics, and run a fixed compiler gate. Repository-relative paths reject traversal and symlink escapes, and the run may commit only requested target changes when the project permits commits and every deterministic check passes.

Treat Lean LSP MCP as advisory. Its diagnostics help the model repair a proof, but an unavailable or timed-out LSP request does not decide correctness. `lake env lean` must accept every target before a run can finish; requested declarations additionally undergo an axiom audit, and risky source constructs such as `sorry`, new axioms, `unsafe`, `partial`, `extern`, or `implemented_by` prevent the stronger outcome.

Use four explicit result levels:

- `kernel_checked` means every target compiled, the requested declarations passed the axiom audit using only the allowed foundational axioms, and source-policy checks found no prohibited construct;
- `compiled` means every target compiled, but declaration-level kernel evidence was not requested or could not be established cleanly;
- `incomplete` means the compiler gate did not accept every target or the run exhausted its model budget before completion;
- `failed` means the execution failed before producing a compiling result.

Accumulate provider usage in the shared agent loop and enforce the remaining project-task token budget in the sandbox run. Compact older proof messages when the retained transcript grows beyond the runner's context threshold, while preserving exact assistant tool calls and tool results in the active history.

## Consequences

Project tasks now support a second execution runtime without weakening the one-turn rule: chat still has one engine, and sandbox execution is named explicitly rather than masquerading as chat. Future sandbox profiles must define their own bounded request, tool, terminal-result, and projection contracts instead of turning `sandbox` into an arbitrary command runner.

The asynchronous hand-off creates more durable state, but each boundary can recover independently. A queue redelivery cannot attach a second run, a terminal redelivery cannot create a second output, and cancellation addresses both the project task and its linked sandbox coordinator.

`standard-3` materially increases container cost and available memory compared with the generic basic container. It is reserved for Lean runs; operators should monitor queue concurrency, runtime, model tokens, image size, and container spend before widening the capability.

The image does not bake every project's Lean toolchain or dependencies. A repository's first run may need outbound network access to download its `lean-toolchain` and Lake dependencies, may take materially longer than a warm run, and may still exceed the configured timeout or `standard-3` capacity. Local Loogle and Lean REPL modes remain disabled because their memory profiles are not predictable within that envelope.

Compiler acceptance is deliberately weaker than kernel evidence. The interface and stored output preserve that distinction instead of presenting every compiling file as a verified theorem.

This repository change adds generated D1 migrations and a new container binding, but it does not apply a remote migration or deploy any Worker. Operators must apply the generated migrations in order and deploy the sandbox Worker before deploying API and web consumers that expose Lean Proofs.
