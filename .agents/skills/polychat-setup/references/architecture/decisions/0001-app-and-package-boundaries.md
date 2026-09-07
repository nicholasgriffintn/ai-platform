# ADR 0001: Keep implementation behind app and package boundaries

Status: Implemented.

## Problem

Deployable responsibilities need separating without turning every large module into a package.

## Decision

Keep the web and public API as orchestration surfaces. Web controllers bind routes, queries and stores to presentation; API routes validate and delegate through `routeBuilder`, `ServiceContext` and repositories.

Keep provider execution behind the API capability registry. Sandbox and training Workers own their specialised execution; the API owns public access and dispatch.

Put wire contracts in `packages/schemas`. Extract reusable runtime code only when a second consumer exists. Keep `component-*` packages independent of routers, stores and API clients: hosts pass data and typed actions, and the packages publish built ESM, declarations and explicit CSS exports with React as a peer dependency. `component-shell` is the one deliberate exception, recorded in [0028](0028-desktop-core-owns-egress.md).

Keep tool descriptors under `services/functions/definitions` separate from executable registrations. Provider implementations consume descriptor data and must not import the provider registry through the tool-execution barrel; that creates an initialisation cycle.

Render tool messages and assistant tool-result parts through the same `ToolResultView`. Use a declared renderer or infer presentation from payload shape, check failure status first, and keep `renderer` separate from `responseType`. Tool-authored HTML is not a presentation contract.

## Consequences

These boundaries add indirection but keep provider, storage and presentation changes local. Module size alone does not justify another package, and a second implementation does not justify copying a registry or turn engine.
