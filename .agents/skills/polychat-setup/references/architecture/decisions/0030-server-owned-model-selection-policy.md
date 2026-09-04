# ADR 0030: Resolve model and realtime availability on the server

Status: Accepted.

Keep provider availability, account access and model defaults from drifting between clients and execution paths.

## Decision

Use the API model policy to derive the executable catalogue and resolve automatic defaults. Explicit IDs must pass the same access checks. Central auxiliary and capability preferences live in `MODEL_DEFAULTS`; they do not grant execution authority.

Publish account-specific `isExecutable` and `isDefault`. Web and iOS repair unavailable picker selections using those facts or request automatic routing, rather than maintaining fallback model IDs. An explicit model or request tier overrides a project's saved automatic routing preference; automatic preferences do not impose a spending limit.

Publish supported service tiers separately from their price multipliers. Clients use catalogue support to offer processing modes, clear an explicit tier when the model changes, and omit the tier for Automatic. Meter the tier actually reported by the provider, which can differ from the request.

Keep the implemented policy active-only. The provider-surface lifecycle design in [0038](0038-provider-surface-model-lifecycle.md) is not implemented and does not currently allow explicit deprecated execution.

Build `/realtime/providers` from registered backend adapters and current account readiness. Keep browser protocol adapters in `library-realtime`; missing protocol support makes a provider unavailable. Represent loading, failure and empty states explicitly. Revalidate credentials and model access when creating a session. Live currently belongs to personal Chat.

Keep Artificial Analysis ingestion and scoring server-side, cache results in D1, and attribute displayed benchmark data. Model catalogue prices remain authoritative; benchmark ingestion must not silently rewrite them.

## Trade-off

Defaults can change with server configuration, and cached readiness can become stale. Clients depend on accurate catalogue projection; execution must revalidate. Provider protocol details and current prices belong in code and provider documentation, not copied into this record.
