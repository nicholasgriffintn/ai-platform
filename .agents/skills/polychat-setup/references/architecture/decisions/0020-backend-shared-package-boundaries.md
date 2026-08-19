# ADR 0020: Extract backend shared packages only where a second consumer exists

## Status

Accepted

## Context

`packages/library-agent-core` showed that reusable backend runtime logic can live in a package: it holds the agent decision loop, approvals, and action handler contracts, carries no runtime dependencies, and serves both `apps/api` and `apps/sandbox-worker`.

That success invites a broader question. `apps/api` holds roughly 60,000 lines of backend logic, including 22,700 lines under `src/lib/providers`, 7,200 under `src/lib/chat`, and 2,600 in `src/lib/formatter`. Deciding by directory size would extract the largest modules first, which are also the ones most entangled with `IEnv`, `ServiceContext`, D1 repositories, and AI Gateway configuration. Moving those into packages relocates the coupling instead of hiding it, and ADR 0001 already puts provider, persistence, sandbox, and training behaviour behind app-owned seams.

ADR 0014 set the bar for frontend packages: a package must provide a stable interface, hide meaningful implementation, and have a credible independent consumer or release reason. The same bar applies to backend code, and most backend modules fail its third clause.

## Decision

Extract a backend package only when a second consumer exists in the repository today. Judge candidates by duplication and coupling, not by size.

Add `packages/library-registry`. `ProviderRegistry` and `ToolRegistry` were the same algorithm written twice: category map, name lowercasing, alias registration, singleton and transient lifecycles, duplicate-registration rejection, and deduplicated summaries. The package owns `CategoryRegistry`, and both registries become typed facades over it.

The package throws `RegistryError` with a `code` of `duplicate_registration`, `unknown_category`, or `unknown_entry`, plus the category and entry name. It does not format host-facing messages and does not depend on `AssistantError`. Each facade maps the error to its own type and wording at the call site, so provider and tool errors keep their existing messages, error types, and context.

Extend `packages/library-client` rather than adding a retry package. It gains `withRetry`, `parseRetryAfterHeaderMs`, and `parseRetryAfterBodyMs`. `apps/sandbox-worker` keeps its own retryable-status policy and clamps and supplies them to `withRetry`. Retryable-status sets stay with their callers because `library-client`'s React Query predicate and the sandbox Worker's request loop deliberately classify different statuses.

Do not extract the following, and record the trigger that would change the answer:

- **Tool runtime** (`PermissionChecker`, `resolveToolPermissions`, `resolveModeMaxSteps`, and a shared tool-definition builder). These have one consumer inside `apps/api`. Extract when a second runtime needs the same mode budgets and permission gating, which agent-mode work outside the API would create.
- **Prompt composition** (`PromptBuilder` and the section modules). `apps/sandbox-worker` assembles prompts with array joins and template literals rather than reimplementing the fluent builder, so there is no duplication to remove. The section modules are Polychat product copy bound to `IBody` and `IUserSettings` and belong in the API regardless.
- **Provider message and response formatting** (`apps/api/src/lib/formatter`). The transformation is pure enough to move, but only the API consumes it. Extract when a second runtime talks to model providers directly.
- **Compaction planning** (`apps/api/src/lib/session`). Planning is separable from persistence and summarisation, but it currently reaches for `ServiceContext`, the chat provider, and prompt modules. Invert those dependencies before considering a package.
- **Provider capability adapters, memory, guardrails, model routing, services, repositories, and database access.** These are single-consumer and correctly owned by `apps/api` under ADR 0001.

## Trade-offs

Two registries now depend on a package for behaviour that was previously readable in one file. The indirection is worth it because the duplicate implementations had already drifted: the tool registry grew `listDefinitions` and instance-derived permissions that the provider registry never received.

`CategoryRegistry` narrows stored instances internally because one registry holds several instance types. The narrowing is contained inside the package and every public signature stays typed through the category map, so no call site casts.

`listEntries` exposes the cached instance, which is populated only after a resolve. `ToolRegistry.list` depends on that timing to report permissions, so the behaviour is deliberate rather than incidental and is covered by a test.

Deferring the tool runtime keeps duplicate tool-definition shapes in the tree while agent-mode work is in flight. That is the cheaper mistake: a premature package would have to be reshaped by the same branch that would justify it.
