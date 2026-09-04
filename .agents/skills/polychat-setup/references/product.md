# Understand Polychat

Polychat is an experimental, multi-model assistant platform. It combines personal chat with collaborative project work and supports agents, retrieval, generated media, realtime sessions, reusable workflows, model training, and sandboxed coding runs.

## Choose a product surface

- **Chat** is personal and conversation-first. It can use the signed-in user's models, agents, connected providers, tools, memories, and installed recipes.
- **Work** is collaborative and workspace-first. Workspaces are the sharing and authorisation boundary; projects contain instructions, conversations, sources, outputs, and selected capabilities.
- **Project experiences** give rich workflows—such as notes, podcasts, generated media, training, or music—more room than a chat turn while keeping their outputs in the project.
- Conversation lists can group threads by date or by their persisted `chat` and `task` purpose. Chat starts with date grouping; Work starts with type grouping, and the project overview keeps its recent list focused on the five latest ordinary chats.
- The project work queue can be searched and filtered by execution status or pipeline stage. Pipeline progress reflects execution rather than configuration: backlog work remains visually inactive, active progress is blue, and completed pipelines are emerald.

Do not reintroduce global apps or recipes as another top-level product mode. Capabilities belong in Chat discovery or a project's library and experiences.

## Set a project routing preference

Choose **Automatic model preference** on the Work project overview to save a default tier for project conversations. Owners and admins can change it; all workspace members can see it. Choose **Auto — no project preference** to restore the ordinary router.

Leave the composer on **Auto** to use the project preference, including when resuming a conversation or running a project recipe without an explicit model. Select another tier or a specific model to override it for that request. Tiers prefer a class of models; they do not impose a spending limit or change model access, and personal Chat keeps its existing behaviour.

Project templates preserve the preference. The API exposes `defaultRouterMode` on project reads and accepts it on project creation and updates, with `auto`, `lite`, `standard`, `pro`, or `max` as values.

## Understand the repository

- `apps/app`: React Router web application and PWA.
- `apps/api`: public Hono API Worker, authentication, persistence, providers, tools, schedules, and webhooks.
- `apps/sandbox-worker`: isolated Cloudflare Sandbox execution for coding tasks.
- `apps/training`: internal provider-backed model training and deployment Worker.
- `apps/mobile/ios`: native iOS client under active development.
- `packages/schemas`: shared Zod contracts published as `@ngriffin_uk/polychat-schemas`.
- `packages/library-*`: reusable client, chat, realtime, React, surface, and agent behaviour.
- `packages/component-*`: reusable React presentation grouped by product responsibility.
- `packages/utility-*` and `packages/config`: stateless helpers and shared package tooling.

The normal starting scope is `apps/app` plus `apps/api`. Add other deployable components only when the user needs their capability.

## Preserve the ownership model

- A workspace membership grants access to its active projects; roles separately protect management operations.
- Project conversations inherit workspace access. Their creator field is attribution, not the only authorisation check.
- Inputs are **sources** and durable results are **outputs**. They are personal without a project and collaborative with one.
- Provider connections and recipe installations remain attributable to a person unless a future decision introduces workspace-owned credentials.
- External writes require explicit, exact approval. Scheduled and event-triggered recipes cannot perform approval-gated writes.
- Usage is metered in **credits** against a person's monthly allowance, never in messages. Project and workspace work is attributed to whoever ran it; there is no workspace-owned pot of credits.

Read [context.md](architecture/context.md) for the complete vocabulary and seams. Read [decisions.md](architecture/decisions.md) before changing product hierarchy, authority, persistence, connectors, approvals, or cross-app responsibilities.
