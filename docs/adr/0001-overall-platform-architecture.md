# Overall Platform Architecture

Status: accepted

Polychat is a pnpm monorepo with a React Router frontend, a Hono API Worker, focused Cloudflare Workers for sandbox and training execution, a small metrics frontend, an iOS client, and shared package modules for schemas and agent execution. We keep the main frontend and API Worker as orchestration surfaces, while deeper modules own persistence, provider capability adapters, local conversation storage, realtime connections, sandbox runs, and training provider execution.

## Decision

- Keep `apps/app` as the primary browser interface. Page modules route and compose, React Query hooks own server/local data coordination, Zustand stores own durable UI/session preferences, `apps/app/src/lib/api` owns HTTP interfaces, and feature modules own rendering and interaction.
- Keep `apps/api` as the public backend interface. `src/index.ts` owns Worker-level middleware, OpenAPI setup, route mounting, scheduled events, queue events, and Durable Object export. Route modules validate and orchestrate through `addRoute`, `ServiceContext`, repositories, and deeper domain modules.
- Keep provider execution behind capability seams in `apps/api/src/lib/providers`. Each capability can have multiple provider adapters, so the registry is a real seam rather than a speculative abstraction.
- Keep D1 access behind repository modules. Backend modules should use `ServiceContext.repositories` or `ServiceContext.database` instead of constructing ad hoc database access at call sites.
- Keep `packages/schemas` as the shared contract module for Zod schemas and TypeScript types used across frontend, backend, sandbox, and training workspaces.
- Keep `packages/agent-core` as the reusable agent-loop module. Sandbox-worker code adapts it to Cloudflare Sandbox, task profiles, GitHub tokens, command approval, cancellation, and SSE progress.
- Keep sandbox and training execution in separate Workers. The API Worker coordinates user-facing auth, records, and routes; the focused Workers own risky or provider-specific execution.

## Consequences

- Cross-app changes often start in `packages/schemas`, then flow into API route validation, frontend clients/hooks, and Worker request handling.
- New backend behaviour should choose the narrowest existing seam before adding another one: route builder, service context, repository, provider capability, task runner, or training provider adapter.
- New frontend behaviour should keep page modules thin and place reusable parsing, serialisation, fetch, state, and formatting logic under `src/lib`, `src/hooks`, or existing state modules.
- The API Worker can remain broad because it is the public interface, but feature internals should not accumulate in `apps/api/src/index.ts` or route files.
- The main trade-off is extra indirection. The benefit is locality: provider swaps, persistence changes, sandbox execution changes, and frontend data-flow changes can be verified at their existing interfaces instead of across many callers.
