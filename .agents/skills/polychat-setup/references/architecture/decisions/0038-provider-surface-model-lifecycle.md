# ADR 0038: Scope future model lifecycle to a provider surface

Status: Accepted design; not implemented.

This design is not implemented in the current catalogue or model policy. Do not describe the states below as available API behaviour.

## Decision

Replace the eventual global deprecation flag with lifecycle for one canonical provider registration, capability category and immutable catalogue model ID. Remote provider names and merge order must not define durable identity.

Distinguish active, deprecated, retired and catalogue-only records. Automatic selection stays active-only. Explicit deprecated execution may continue before a reviewed deadline; retired, deadline-passed and catalogue-only records cannot execute. A replacement is guidance, never permission to silently rewrite saved intent.

Enforce lifecycle through the existing server model-policy boundary before each new provider invocation, including retries, queued work and realtime renewal. Preserve executed identity and warnings in history. Keep historical records rather than deleting identifiers referenced by saved work.

## Trade-off

This permits deliberate migration windows but requires reviewed surface-specific metadata, stable identifiers and client notices. It needs shared schemas and execution guards before it can replace [the current active-only policy](0030-server-owned-model-selection-policy.md).
