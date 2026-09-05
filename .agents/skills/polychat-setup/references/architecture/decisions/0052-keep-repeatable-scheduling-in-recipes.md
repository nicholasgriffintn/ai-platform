# ADR 0052: Keep repeatable scheduling in recipes

Status: Accepted and implemented.

Recipes are Polychat's repeatable work definition. Giving conversations their own schedule state would duplicate trigger, ownership, execution and failure semantics while making it unclear whether the recipe or the conversation controls a future run.

## Decision

Keep recipe installations as the only user-facing scheduling resource. A recipe schedule trigger owns its cron expression, prompt, enablement and optional notification delivery. Its installation owns the saved configuration, charging identity and connector selection.

Use the existing recipe scheduler to enqueue deterministic `recipe_execution` tasks. `RecipeExecutionHandler` revalidates the installation and any project capability before invoking the recipe under its owner's current account. Each occurrence produces an attributable conversation for its result; it does not resume an arbitrary conversation or turn conversation history into executable configuration.

Manage schedules only from recipe capability and project Scheduled recipes surfaces. A conversation may display provenance linking it to the recipe installation and task occurrence, but it cannot create, pause, resume, edit or delete a separate schedule. Do not add a conversation-schedule contract, table, route, repository, task type, due scanner or client state.

Keep event triggers under the same recipe installation and connector-authority model. Project membership permits authorised reads but does not transfer schedule ownership, charging responsibility or another member's connector credentials.

## Consequence

Scheduling has one interface and one implementation path. Scheduled runs create separate result conversations, so durable context must live in recipe configuration, project instructions or Sources rather than relying on the mutable history of an earlier conversation. Supporting a new timing form requires extending recipe triggers and their scheduler, not introducing another scheduled resource.
