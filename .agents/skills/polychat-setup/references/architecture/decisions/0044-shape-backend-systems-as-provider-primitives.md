# ADR 0044: Keep backend primitives in host-agnostic packages

Status: Implemented.

## Problem

Provider resolution, credentials, fallback and error handling were tied to the API. Other hosts needed the same behaviour, but could not reuse it without importing API-specific types and errors.

## Decision

- Put reusable backend mechanisms in focused packages. Keep them generic over host types and make them throw coded errors that the host can map.
- Keep provider adapters and resolution in `@ngriffin_uk/polychat-ai-providers`. Hosts supply a `ProviderHost`, register host-specific providers and policies, and map package errors at the infrastructure boundary.
- Use `ai-*` for host-facing capabilities, `library-*` for reusable domain mechanisms and `utility-*` for shared helpers.
- Extract a mechanism when another consumer needs it; do not create packages only to reduce module size.

## Consequences

API modules and workers can share provider behaviour without sharing host state. Each package owns its mechanism and error contract, while the application remains responsible for access checks, persistence and host-specific policy.
