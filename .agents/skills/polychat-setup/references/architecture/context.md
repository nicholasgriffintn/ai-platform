# Architecture context

Use this as the ownership and responsibility map. Detailed rationale is in [decisions](decisions.md).

## Vocabulary

- **Chat / Work**: personal vs collaborative surfaces on one runtime.
- **Project**: shared instructions, files, conversations, tasks, and access in a workspace.
- **Run**: one accepted stored execution with stable identity and attempt history.
- **Scope**: personal or project authority boundaries.
- **Conversation**: durable user history; **Activity**: user-visible execution trace.
- **Teammate context**: one teammate's durable home, grants, routines and computer within a personal or project scope.
- **Platform teammate**: a read-only teammate defined in code and available to every project by default; its tools and skills are platform grants.
- **Workflow**: a code-defined sequence of project flow stages that can be applied and then edited as task phases.
- **Brief**: a revisioned memory document explicitly bound to a conversation and loaded into its runs.
- **Model version**: an open model or dataset pinned to a Hub commit with hashed files; the unit that evidence, decisions and lineage attach to (Work › Models).
- **Evidence / Decision**: dated, append-only observations about a version, and the approval that cites them for a workspace or project scope.
- **Route**: a version served by a provider in a region; approved separately from the version and enforced in project chats when a workspace opts in.
- **Build**: a fine-tune from an approved base and a governed dataset snapshot whose output is a derived version that re-enters review.

## Model governance

- `modules/model-registry` owns import, inspection, policies, decisions, routes, evals, builds, deployment and ML-BOM export; pure mechanisms live in `library-model-registry` and Hub access in `ai-model-sources`.
- Inspection parses byte ranges and never loads weights. Policy evaluation is a pure function shared by enforcement, previews and dry runs.
- Hugging Face credentials resolve per workspace (`workspace_provider_connection`, sealed with `PRIVATE_KEY`) before the platform `HUGGINGFACE_*` defaults, and reach the training worker through service-binding props.
- Queue tasks: `model_registry_inspect`, `model_registry_eval`. Build sync runs every cron tick; replays and decision expiry run daily.

## Deployables and owners

- `apps/app`: web/PWA presentation and route composition.
- `apps/api`: request orchestration, validation, persistence, provider adapters, webhooks, queue tasks.
- `apps/desktop`: native shell, secure signing/everything local-first where possible.
- `apps/sandbox-worker`: coding execution boundary, approvals, preview gateway.
- `apps/computer-worker`: hosted graphical computer lifecycle, screen sessions, checkpoints and fenced control.
- `apps/training`: model training/deployment execution jobs.
- `apps/mobile/ios`: native client consuming API streams and push.
- Shared packages own contracts and reusable UI, leaving API calls and storage ownership at hosts.
- Backend mechanisms live in primitives packages: `ai-*` for host-facing interaction (providers, functions, agents, workflows, models, billing, telemetry), `library-*` for the mechanisms they compose (agent loop, tools, tasks, model catalogue), `utility-*` for helpers. Packages are generic over host types, throw coded errors, and the API maps them at one boundary.

## Conversation execution

- `services/chat/core` handles request orchestration; `apps/api/src/lib` holds only host infrastructure (database, http, storage, cloudflare, durable objects, provider host, telemetry), and every product capability lives under `services/<capability>`.
- Finalisation owns persistence, cleanup, lock release and run status.
- Streams are authoritative only for transport; recovery uses stored snapshots and ordered events.
- Model loops are bounded by provider readiness, context budgets, and usage controls.
- Teammate entry points resolve one invocation, snapshot its configuration, then use the same run engine.
- Durable result projection is independent from whether an optional parent model wake is admitted.

## Work and coding

- `project-tasks`, `attention`, `task-notifications`, and `conversation-organisation` own project execution and delivery signals.
- Sandbox/Workbench uses versioned contracts from `schemas/sandbox*`, environment snapshots, and authenticated previews.
- Model-written code runs through `run_code` in a dynamic Worker isolate (`ai-sandbox` over the `LOADER` binding); tools reach it through the loopback `OutboundGateway`, never through the container sandbox.
- Avoid adding extra workbench tables or duplicate contracts outside existing channels.

## Data, authority, and spend

- Membership + workspace role decides project access.
- External credentials remain personal unless explicitly shared by design.
- Teammate connector access is an exact account-and-operation grant, revalidated at every operation.
- Hosted computer control uses expiring leases and monotonically increasing fences.
- Vector retrieval uses scoped authority and immutable provenance.
- Credits are reserved, used, and settled as separate accounting states.
- Feature flags and experiments are defined in code (`services/experiments`), bucketed on the analytics distinct id, optionally overridden by the Flagship `FLAGS` binding, and exposed to telemetry as `feature_flag.evaluation` events plus `experiment.<key>` properties on outcomes and generations.

## Web and desktop

- Desktop owns egress and system-level secrets; web uses host boundaries.
- Machine sessions use short-lived adverts and relay coordination with explicit revalidation.
- Both hosts share navigation, form, and rendering standards, and resolve actions via host-aware stores/routes.
