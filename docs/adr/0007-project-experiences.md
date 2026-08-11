# ADR 0007: Project-scoped rich experiences

## Status

Accepted.

## Context

Removing global app and recipe pages clarified the Chat and Work split, but it also removed useful interfaces for workflows that do not fit comfortably inside a conversation or one dynamic form. Notes, article research, podcast processing, media-model runs, training, and live music editing need durable lists, detail views, and multi-step controls.

Restoring `/apps` would recreate the third product mode rejected by ADR 0006. Treating rich outputs as creator-owned would also make them disappear for other members of the project that produced them.

## Decision

Expose rich workflows as **project experiences** below `/work/:workspaceId/projects/:projectId/experiences`. Only experiences backed by enabled project capabilities are visible and openable. Reuse the existing Polychat components and runtimes; do not create a separate visual system or restore compatibility routes.

Publish experience and model-tool definitions from `/dynamic-apps`, and keep recipe categories, integrations, configuration fields, and installation settings in `/apps/recipes`. The frontend may contain compiled runtime adapters for mounting a supported app experience, but it must not duplicate experience IDs, labels, categories, icons, descriptions, or tool presentation metadata. The project capability library consumes the complete API catalogues and stores project associations. It mounts the original recipe lifecycle directly—there is no separate recipe experience—and routes recipe chat launches back into the project.

Treat model tools as default project capabilities. Definitions marked `requiresConfiguration` stay inactive until their API-declared configuration runtime has valid stored project settings; project chat resolves those settings into provider tool options on the backend.

Persist Notes, Articles, Podcasts, Replicate predictions, Strudel patterns, and dynamic app results as outputs. Keep the creating user as attribution, assign collaborative results to a project, and authorise every project-scoped operation through current workspace membership. ADR 0009 replaces the original `app_data` implementation described by this decision.

Training remains provider-account scoped because provider jobs and deployments are not portable app-data records. A project capability controls access to the Training experience, but the underlying provider account still determines the visible jobs and deployments.

## Trade-offs

Project experience routes are deliberately breaking replacements for the removed global pages. Existing `/apps/...` bookmarks remain invalid, but the product retains a single Chat/Work hierarchy.

Project members can collaborate on project-owned outputs regardless of creator. Recipe installation credentials and external provider accounts remain user-bound where the upstream service requires them; moving those credentials to workspace ownership would need a separate secrets and connection model.
