# Dynamic Runtime Worker

Cloudflare Dynamic Workers runtime used for lightweight code-mode style execution.

## Endpoints

- `POST /execute-dynamic` - Runs a dynamic worker task and streams SSE events.
- `POST /execute` - Sandbox-compatible endpoint for read-only task fallback.

## Security defaults

- Dynamic worker child runs with `globalOutbound: null`.
- Capabilities are passed via service bindings (`ctx.exports`).
- JWT auth matches API->worker trust boundary.
