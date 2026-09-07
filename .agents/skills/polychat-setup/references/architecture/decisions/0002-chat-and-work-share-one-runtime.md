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
