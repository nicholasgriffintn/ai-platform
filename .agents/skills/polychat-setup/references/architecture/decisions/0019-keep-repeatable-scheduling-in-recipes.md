# ADR 0019: Keep repeatable scheduling in recipes

Status: Implemented.

## Problem

Recipes are Polychat's repeatable work definition. Giving conversations their own schedule state would duplicate trigger, ownership, execution and failure semantics while making it unclear whether the recipe or the conversation controls a future run.

## Decision

Keep recipe installations as the only user-facing scheduling resource. A recipe schedule trigger owns its cron expression, prompt, enablement and optional notification delivery. Its installation owns the saved configuration, charging identity and connector selection.

Use the existing recipe scheduler to enqueue deterministic `recipe_execution` tasks. The execution handler revalidates the installation and any project capability before invoking the recipe under its owner's current account. Each occurrence produces an attributable conversation for its result; it does not resume an arbitrary conversation or turn conversation history into executable configuration.

Every trigger has a stable identifier. Scheduled occurrences are identified by installation, trigger and scheduled UTC minute, while event occurrences use the provider event identity. Cron triggers always name an IANA timezone; existing schedules become explicit UTC. A missing local time during a daylight-saving transition does not run, while a repeated local time produces two distinct UTC occurrences. After scheduler downtime, enqueue at most the four most recent missed occurrences within 31 days. One-shot triggers enqueue once when due and disable only after their deterministic task is persisted.

Manage schedules only from recipe capability and project Scheduled recipes surfaces. A conversation may display provenance linking it to the recipe installation and task occurrence, but it cannot create, pause, resume, edit or delete a schedule. Do not add a conversation-schedule contract, table, route, repository, task type, due scanner or client state.

Keep event triggers under the same recipe installation and connector-authority model. Project membership permits authorised reads but does not transfer schedule ownership, charging responsibility or another member's connector credentials.

## Consequences

Scheduling has one interface and one implementation path. Scheduled runs create separate result conversations, so durable context must live in recipe configuration, project instructions or Sources rather than in the mutable history of an earlier conversation. Supporting a new timing form means extending recipe triggers and their scheduler, not introducing another scheduled resource.
