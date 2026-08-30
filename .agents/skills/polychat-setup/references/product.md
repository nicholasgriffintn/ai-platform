# Understand Polychat

Polychat is an experimental, multi-model assistant platform. It combines personal chat with collaborative project work and supports agents, retrieval, generated media, realtime sessions, reusable workflows, model training, and sandboxed coding runs.

## Choose a product surface

- **Chat** is personal and conversation-first. It can use the signed-in user's models, agents, connected providers, tools, memories, and installed recipes.
- **Work** is collaborative and workspace-first. Workspaces are the sharing and authorisation boundary; projects contain instructions, conversations, sources, outputs, and selected capabilities.
- **Project experiences** give rich workflows—such as notes, podcasts, generated media, training, or music—more room than a chat turn while keeping their outputs in the project.

Do not reintroduce global apps or recipes as another top-level product mode. Capabilities belong in Chat discovery or a project's library and experiences.

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

## Respect what a locked conversation gives up

A Pro user can lock a personal conversation. It is then encrypted on their device with a passkey or a password, and Polychat stores only wrapped keys and sealed envelopes. The model provider still receives plaintext, because a model cannot answer ciphertext, and any copy that claims otherwise is wrong.

- Locking removes tools, retrieval, memory, attachments, sharing, search, titles, projects, agents, goals, and server-side compaction. That list is the feature, not a gap to close.
- Locking an existing conversation destroys the plaintext and files the server holds for it. Confirm it explicitly; it cannot be undone.
- There is no password reset. Every lock carries a recovery key, shown once.
- Replies stop when the tab closes, because a locked turn has nowhere to save its answer.
- iOS lists locked conversations and points at the web app. Do not render envelopes as message text anywhere.

## Preserve the ownership model

- A workspace membership grants access to its active projects; roles separately protect management operations.
- Project conversations inherit workspace access. Their creator field is attribution, not the only authorisation check.
- Inputs are **sources** and durable results are **outputs**. They are personal without a project and collaborative with one.
- Provider connections and recipe installations remain attributable to a person unless a future decision introduces workspace-owned credentials.
- External writes require explicit, exact approval. Scheduled and event-triggered recipes cannot perform approval-gated writes.

Read [context.md](architecture/context.md) for the complete vocabulary and seams. Read [decisions.md](architecture/decisions.md) before changing product hierarchy, authority, persistence, connectors, approvals, or cross-app responsibilities.
