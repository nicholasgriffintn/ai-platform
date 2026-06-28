# ADR 0003: Assistant action launch contract

## Status

Accepted.

## Context

Recipes, dynamic apps, connectors, agents, and model tools all appear in the composer as assistant actions. Discovery was already centralised through `packages/schemas/src/assistant-actions.ts`, but execution still depended on frontend branches over item kind, metadata shape, URL parameters, enabled tools, and recipe request options.

That made the catalogue shallow: callers could find a capability through one interface, then needed separate knowledge to launch it correctly.

## Decision

Keep the assistant action catalogue as the shared product seam for composer-discoverable capabilities. Each catalogue item now carries a `launch` contract describing whether selection opens a conversation, navigates in-app, opens an external authorisation flow, toggles a tool, or schedules a recipe.

Frontend execution should switch on the launch contract. Item kind remains display and grouping metadata, not the source of execution behaviour.

## Trade-offs

The catalogue schema is slightly richer, and legacy selections need compatibility while stored or mocked items catch up. The benefit is locality: adding or changing an assistant action should update catalogue construction and its adapter, not every composer execution branch.
