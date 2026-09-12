# Architecture context

Use this as the ownership and responsibility map. Detailed rationale is in [decisions](decisions.md).

## Vocabulary

- **Chat / Work**: personal vs collaborative surfaces on one runtime.
- **Project**: shared instructions, files, conversations, tasks, and access in a workspace.
- **Run**: one accepted stored execution with stable identity and attempt history.
- **Scope**: personal or project authority boundaries.
- **Conversation**: durable user history; **Activity**: user-visible execution trace.
- **Teammate context**: one teammate's durable home, grants, routines and computer within a personal or project scope.
- **Brief**: a revisioned memory document explicitly bound to a conversation and loaded into its runs.

## Deployables and owners

- `apps/app`: web/PWA presentation and route composition.
- `apps/api`: request orchestration, validation, persistence, provider adapters, webhooks, queue tasks.
- `apps/desktop`: native shell, secure signing/everything local-first where possible.
- `apps/sandbox-worker`: coding execution boundary, approvals, preview gateway.
- `apps/computer-worker`: hosted graphical computer lifecycle, screen sessions, checkpoints and fenced control.
- `apps/training`: model training/deployment execution jobs.
- `apps/mobile/ios`: native client consuming API streams and push.
- Shared packages own contracts and reusable UI, leaving API calls and storage ownership at hosts.

## Conversation execution

- `lib/chat/core` handles request orchestration.
- Finalisation owns persistence, cleanup, lock release and run status.
- Streams are authoritative only for transport; recovery uses stored snapshots and ordered events.
- Model loops are bounded by provider readiness, context budgets, and usage controls.
- Teammate entry points resolve one invocation, snapshot its configuration, then use the same run engine.
- Durable result projection is independent from whether an optional parent model wake is admitted.

## Work and coding

- `project-tasks`, `attention`, `task-notifications`, and `conversation-organisation` own project execution and delivery signals.
- Sandbox/Workbench uses versioned contracts from `schemas/sandbox*`, environment snapshots, and authenticated previews.
- Avoid adding extra workbench tables or duplicate contracts outside existing channels.

## Data, authority, and spend

- Membership + workspace role decides project access.
- External credentials remain personal unless explicitly shared by design.
- Teammate connector access is an exact account-and-operation grant, revalidated at every operation.
- Hosted computer control uses expiring leases and monotonically increasing fences.
- Vector retrieval uses scoped authority and immutable provenance.
- Credits are reserved, used, and settled as separate accounting states.

## Web and desktop

- Desktop owns egress and system-level secrets; web uses host boundaries.
- Machine sessions use short-lived adverts and relay coordination with explicit revalidation.
- Both hosts share navigation, form, and rendering standards, and resolve actions via host-aware stores/routes.
