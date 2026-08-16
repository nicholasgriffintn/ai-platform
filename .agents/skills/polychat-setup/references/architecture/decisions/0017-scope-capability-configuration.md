# ADR 0017: Scope capability configuration separately from enablement

## Status

Accepted

## Context

Configurable model tools need durable settings in both personal Chat and collaborative projects. A user-and-tool-specific table would encode the first caller in the persistence model, while storing project settings on `project_capability` would conflate runtime configuration with a project authorisation association.

Those shapes make another scope or capability kind require a parallel table and adapter even though the storage contract is the same. They also encourage callers to infer enablement or ownership from the presence of configuration.

## Decision

Persist runtime settings in `capability_configuration`, keyed by scope type, scope ID, capability kind, and capability ID. Treat user and project behaviour as adapters at the service boundary: personal routes derive user scope from authentication, while project services establish workspace access and role policy before entering the persistence seam.

Keep configuration separate from enablement and authority. Personal capabilities remain available by default under ADR 0016. `project_capability` remains the project enablement and association record, and project configuration changes are atomic with that association.

Validate configuration through the owning capability runtime before persistence. Provider adapters receive only validated settings selected by the authorised chat scope.

## Trade-offs

A polymorphic scope key cannot use one database foreign key for every owner type. Owning services must therefore clean up scoped rows as part of their lifecycle operations; workspace deletion and project-capability removal do this explicitly.

Scope IDs share a text representation even when the underlying owner uses a numeric ID. The repository owns that conversion so callers use domain-native identifiers.

The generic record deliberately does not replace family-specific API contracts. Personal tool routes may still return tool-shaped data, and project routes may return project capability associations; both adapt the same persistence interface without exposing its shape to clients.
