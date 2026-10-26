# ADR 0002: Share one runtime across Chat and Work

Status: Implemented.

## Problem

Personal conversation and collaborative work need separating without duplicating their runtimes.

## Decision

Keep two product modes: personal Chat under `/chat` and collaborative Work under `/work`. Workspaces own membership; projects hold instructions, conversations, context and capabilities. There is no third global destination for apps or recipes.

Use the same conversation thread, composer, capability library and experience components with an explicit personal or project scope. An app is a curated experience with an owning capability; a function tool is not an app. Chat and Work open apps through one scoped `AppRoute`.

Personal experiences and tools need no enablement association, but still require account, plan and configuration checks. Recipes need installation; personal skill opt-outs are curation. Project capabilities constrain shared execution. Always-on skills and default project tools follow their explicit runtime rules; configurable tools stay inactive until valid settings exist.

Authorise project conversations through current workspace membership, not creator attribution. Standalone conversations remain personal unless explicitly shared. Keep external provider credentials attributable to a person even when used in Work.

## Consequences

Workspace members share a broad collaboration boundary. Personal and project navigation differ, but finer project ACLs or workspace-owned credentials would need a separate ownership decision.

## Amendment: Work runs on tasks

Work has no free conversations. A project opens on its task list, and a request made in Work becomes a task with a key, an owner and a thread. The thread is the task's own conversation, so Chat and Work still share one runtime. A project conversation route remains only as the run view of a task conversation, which keeps the coding Workbench from [0023](0023-present-coding-work-in-project-conversations.md). Existing project conversations were migrated into done tasks with their conversations attached. Teammate groups and free conversation stay in Chat.
