# ADR 0006: Share capabilities across Chat and Work

Status: Accepted.

Separate personal conversation from collaborative work without duplicating their runtimes.

## Decision

Keep two product modes: personal Chat under `/chat` and collaborative Work under `/work`. Workspaces own membership; projects hold instructions, conversations, context and capabilities. Do not restore global app or recipe destinations.

Use the same conversation thread, composer, capability library and experience components with an explicit personal or project scope. Publish experiences and model tools from `/capabilities`, recipes from `/apps/recipes`, and function tools from `/tools`. An app is a curated experience with an owning capability; a function tool is not an app.

Personal experiences and tools need no enablement association, but still require account, plan and configuration checks. Recipes need installation; personal skill opt-outs are curation. Project capabilities constrain shared execution. Always-on skills and default project tools follow their explicit runtime rules; configurable tools remain inactive until valid settings exist.

Keep apps in scope-local experience routes. Work composer actions preserve project metadata and use project-enabled recipes. Hosted model-tool choices remain distinct from managed function-tool selection.

Authorise project conversations through current workspace membership, not creator attribution. Standalone conversations remain personal unless explicitly shared. Keep external provider credentials attributable to a person even when used in Work.

## Trade-off

Workspace members share a broad collaboration boundary. Personal and project navigation differ, but introducing finer project ACLs or workspace credentials would require a separate ownership decision.
