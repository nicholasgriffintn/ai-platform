# ADR 0006: Workspace-centred Work mode

## Status

Accepted

## Context

Polychat exposed chat, apps, recipes, and specialist tools as competing global destinations. Conversations were creator-owned, which did not provide a durable boundary for shared project work or a clear place for team context and capabilities.

The product needs a clean personal chat surface and a collaborative work surface without maintaining the old information architecture alongside the new one.

## Decision

Split the product into Chat and Work modes. Chat keeps a conversation-first `/chat` surface and lists only non-project conversations. Work uses `/work` with workspaces as the sharing and authorisation boundary and projects as the unit of instructions, conversations, and capabilities.

Represent workspace access with explicit `owner`, `admin`, and `member` memberships. Invite members through expiring, email-bound, single-use tokens: return the raw token in the invitation URL, persist only its hash, and consume or revoke it after use. Owners control owner-only operations and administrator invitations; owners and administrators manage projects and capability selection.

Attach collaborative conversations to projects. Keep `conversation.user_id` as immutable creator attribution, but authorise project conversation reads and writes through current membership of the parent workspace. Keep standalone conversations private to their creator unless the existing public-sharing flow is used.

Replace the global apps and recipes destinations with project capability libraries and chat composer discovery. Preserve app, recipe, connector, and tool runtimes as internal capability implementations, but remove their global routes and navigation without redirects or compatibility layers.

## Trade-offs

Workspace members share a broad collaboration boundary: every member can read and update project conversations, while role checks protect workspace, project, invitation, and capability administration. Finer project roles or per-conversation ACLs would require a later explicit model rather than overloading creator attribution.

Removing global app and recipe routes breaks saved links and makes capability execution dependent on Chat or project surfaces. The benefit is one clear place for personal conversation and one clear hierarchy for collaborative work, with membership and project scope enforced consistently by the backend.
