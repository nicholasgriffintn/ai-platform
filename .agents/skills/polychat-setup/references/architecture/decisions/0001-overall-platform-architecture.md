# ADR 0001: Keep implementation behind app and package boundaries

Status: Accepted.

Separate deployable responsibilities without turning every large module into a package.

## Decision

- Keep the web and public API as orchestration surfaces. Web controllers bind routes, queries and stores to presentation; API routes validate and delegate through `routeBuilder`, `ServiceContext` and repositories.
- Keep provider execution behind the API capability registry. Sandbox and training Workers own their specialised execution, while the API owns public access and dispatch.
- Put wire contracts in `packages/schemas`. Extract reusable runtime code only when a second consumer exists; use `library-agent-core`, `library-tool-runtime`, `library-registry` and `library-client` for their existing responsibilities.
- Keep `component-*` packages independent of routers, stores and API clients. Pass data and typed actions from the host. Publish built ESM, declarations and explicit CSS exports, with React as a peer dependency.
- Keep tool descriptors under `services/functions/definitions` separate from executable registrations. Provider implementations consume descriptor data and must not import the provider registry through the tool-execution barrel; that creates an initialisation cycle.
- Render tool messages and assistant tool-result parts through the same `ToolResultView`. Use a declared renderer or infer presentation from payload shape, check failure status first, and keep `renderer` separate from `responseType`. Specialised views are registered React components; tool-authored HTML is not a presentation contract.

## Trade-off

These boundaries add indirection but keep provider, storage and presentation changes local. Module size alone does not justify another package, and a second implementation does not justify copying a registry or turn engine.
