# ADR 0040: Resolve future provider governance before execution

Status: Accepted design; not implemented.

The current repository has no shared scope-policy resolver or reviewed operation-profile contract; do not claim retention or residency enforcement from this record.

## Decision

Keep three concepts separate: scope-owned constraints, reviewed facts about one provider operation, and the server's execution decision. Constrain API surface, region, retention, storage, caching and external state independently; provider names alone cannot prove them.

Resolve personal policy for personal work and project policy for project work. A runner's credentials do not replace project policy. Requests may only tighten inherited constraints. Keep credentials and endpoints in the connection seam, not policy configuration.

Deepen the existing capability-configuration and provider execution boundaries. Authorise the capability, intersect current policy with complete reviewed operation facts, select a compatible candidate, and revalidate immediately before I/O. Missing or expired facts fail closed. Separate Workers need scoped, short-lived internal authority rather than treating queued input as permission.

Keep status, cancellation, revocation and cleanup bound to the original external resource when policy tightens. Blocking new creation must not strand existing data. Publish sanitised explanations without exposing connection identifiers or secrets.

## Trade-off

This adds substantial provider-review and cross-Worker implementation work. Retain it as a design constraint, not a setup prerequisite or compliance promise; implementation requires a separately scoped change.
