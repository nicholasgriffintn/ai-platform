# ADR 0010: Project context and user-authorised recipes

## Status

Accepted

## Context

Project members need shared memory, persistent conversation context, and visible automation without turning personal provider credentials into workspace secrets. A scheduled recipe also needs to create its conversation inside the project rather than falling back to personal Chat.

Capability associations already record who attached them, while recipe installations already own configuration and triggers. Replacing those seams with workspace credentials or a second automation model would duplicate consent, connection, and scheduling behaviour.

## Decision

Allow any project member to attach an app or recipe capability. Every member may see the association, but only its creator may update or remove it. Keep project tools administrator-managed because their configuration changes the server-owned runtime for every conversation.

Store project recipe installations as templates with both `project_id` and `created_by_user_id`. List them to project members, restrict mutation to the creator, and continue resolving connector credentials from the executing user's provider connections. Carry the project ID through scheduled task data, invocation, and chat completion so every scheduled result becomes a project conversation using project instructions and capabilities.

Represent persistent context as a reserved project source collection with kind `context`. Owners and administrators select available project sources for it. Attach those sources and all available project memories to project conversations, including the first message auto-submitted from the project overview.

## Trade-offs

Different members may configure and schedule the same enabled recipe with their own credentials, which creates multiple visible installations. This is intentional: authority and revocation remain attributable to a person.

Project context increases the default prompt payload, so selection stays explicit and separate from the complete source library. Workspace-owned provider accounts remain out of scope and would require a distinct secrets, consent, and offboarding model.
