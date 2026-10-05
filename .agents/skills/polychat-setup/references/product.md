# Understand Polychat

Polychat has two primary modes:

- **Chat**: personal conversation, memory, documents, and one-to-one capabilities.
- **Work**: shared projects, project tasks/flows, and teamwork surfaces.

## Core navigation

- Chat and Work each have dedicated sidebars.
- Projects expose Conversations, Files, Tasks, Activity, and setup controls.
- The **Poly** control is the product command surface for search, pin/unpin, archive, and summaries; it never approves writes.
- **Attention** shows personal and project items needing action across all accessible workspaces.

## Work modes

- Use a Conversation for interactive asks.
- Use Experiences/apps for structured workflows.
- Use recipes for reusable scheduling.
- Use project tasks/flows for durable delegated work.
- Create teammates as built-in role colleagues or bots; colleagues can file work, bots are read-only unless policies allow writes.

## Sources, outputs and model execution

- Sources are durable input; Outputs are durable results.
- Model readiness is checked at execution and revalidated if access changes.
- Changing a model affects the next run only; existing attachments and history remain where compatible.
- Project membership does not transfer another member’s external credentials.

## Reliability and authority

- Each accepted run has a stable run identity and durable state.
- Reconnection resumes only authoritative state; older local assumptions are not trusted.
- Tool approvals are explicit and persisted separately from assistant prose.
- Stop actions are best-effort and can arrive after a provider call has already completed.

## Project work and delivery

- Active run state is reflected in Attention and Activity.
- Coding work is presented through Project Workbench against the same conversation.
- Delivery happens only after owner approval and explicit branch/target policy confirmation.
- Workspace owners and admins control project-level delivery and environment settings.

## Visibility and controls

- Pin, unread, and snooze are personal controls, even in shared project space.
- Recipes with schedules create attributable conversation instances; keep durable state in recipe configuration and project Sources.
- iOS and desktop reuse the same conversational contract with host-specific notification and membership checks.

## Cost and reporting

Run usage is account-scoped, reserved first and settled after terminal accounting.
See [usage operations](operations/loop-cost-controls.md) and [architecture context](architecture/context.md) for spend and authority boundaries.
