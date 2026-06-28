# ADR 0004: Assistant capability descriptor

## Status

Accepted.

## Context

Recipes, dynamic apps, connectors, agents, and tools are product capabilities, but their runtimes are deliberately different. Dynamic apps execute form-backed functions, frontend apps navigate to app routes, recipes install workflow state and run through chat, and connectors expose auth plus provider operations.

The UI needs shared catalogue facts without learning each runtime. Before this decision, apps and recipes exposed their own catalogue shapes, so callers had to infer availability, launch behaviour, execution mode, auth requirement, and saved-state support from family-specific fields.

## Decision

Publish product-level capability facts through `AssistantCapabilityDescriptor` in `packages/schemas/src/apps.ts`. Catalogue modules attach the descriptor through family-specific adapters while keeping their runtimes separate.

Dynamic app descriptors live behind `apps/api/src/services/dynamic-apps/capabilities.ts`. Recipe descriptors live behind `apps/api/src/services/apps/recipes/capabilities.ts`. New capability families should add an adapter that maps their native catalogue shape into the descriptor instead of adding UI-specific branches.

## Trade-offs

The descriptor duplicates a small amount of catalogue metadata, such as name, description, and tags. The benefit is a deeper interface: apps pages, composer surfaces, and future capability catalogues can reason over shared product facts without knowing whether the implementation is a form, route, connector, agent, or workflow.
