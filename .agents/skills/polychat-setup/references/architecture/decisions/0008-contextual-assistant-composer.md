# ADR 0008: Contextual assistant composer ownership

## Status

Accepted

## Context

Chat and Work share the conversation renderer and composer, but they do not share the same authority boundary. Chat is personal and may use the user's connected providers and model-tool preferences. Work is project-scoped: project capabilities, instructions, and effective tools must remain authoritative for every member.

An unscoped action catalogue also allowed global app launch contracts and personal tool controls to leak into Work. Action-specific request options could additionally replace project metadata if they were passed as a complete object.

## Decision

Keep `ConversationThread` as the shared selection, launch, request-option, and submission boundary. Let each entry point provide a mode configuration that controls:

- which catalogue families are discoverable;
- which project capability kind and ID pairs are allowed;
- where app and recipe actions navigate; and
- which request metadata must survive action-specific options.

Chat retains personal discovery for installed recipes, connected connectors, agents, and model tools. Work's composer discovers project-enabled recipes only; apps remain in the project library and experience routes, and are not composer actions. Work hides personal tool selection and sends the project ID on every request. The backend remains authoritative: it validates app and recipe references when capabilities are added and resolves project tools and options instead of trusting client replacements.

Connector credentials remain user-scoped. Work may use a connected account through an enabled recipe, but connector setup and credential management stay in the user's provider settings rather than becoming project capability records.

## Trade-offs

The composer has a small amount of mode configuration, but discovery and navigation remain explicit at the boundary instead of requiring Chat and Work forks of the conversation implementation. Project members see fewer personal controls in Work, while project administrators retain capability management in the library. Moving connectors to workspace-owned credentials would require a separate secrets and consent model.
