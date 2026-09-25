# ADR 0063: Approve routes separately from versions

Status: Implemented.

## Problem

The same open weights are served by many providers the catalogue already knows: Together, Fireworks, Workers AI, Regolo, or a dedicated Inference Endpoint. Residency, retention and whether the provider proves which weights it serves belong to where a model runs, not to the weights. Folding them into the version approval either blocks good models for one bad host or waves through a bad host for a good model.

## Decision

A **route** is a version served by a provider under a catalogue model ID in a region, with a `weightsVerified` flag that is true only for dedicated deployments. Route conditions (`route_region`, `route_weights_unverified`) are evaluated only when a route is in play. A route is usable in a scope when approvals cover both its version-level and route-level issues.

Suggested routes come from the catalogue's `matchingModel` mapping. Deploying a version to a Hugging Face Inference Endpoint registers a verified route and queues the scope's eval suites against it once the endpoint is up.

When a workspace sets enforcement to `enforced`, project chats may only use approved routes; a tier-selected model falls back to the first approved route instead of failing. Every generation that runs through an approved route carries `polychat.route_id` and `polychat.asset_version_id` in its analytics.

## Consequences

Enforcement and telemetry key on `provider:modelId`, which is what chat already resolves, so usage and cost join back to a version without new metering. A catalogue model that maps to several Hub repositories still needs the right version picked by hand when registering a route.
