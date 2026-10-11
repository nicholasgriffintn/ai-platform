# ADR 0070: Run the model platform on workspace accounts

Status: Implemented.

## Problem

Model training and serving use external provider accounts and incur costs. Using a platform-owned account would centralise workspace data, provider access and billing, and would make it harder for each workspace to manage its own limits and revoke access.

## Decision

- Workspaces connect the providers used for model registry, training and serving. Seal credentials at rest, scope them to the workspace and resolve them for each provider operation.
- Keep provider integrations behind shared `ai-model-providers` adapters. The API owns model orchestration, policy and provider access; no separate training worker is used.
- Store canonical training and deployment configuration with each run. Pin model versions to source revisions and file hashes, and attach evidence, approvals and lineage to those versions.
- Store uploads and dataset artefacts in private R2 storage. Publish uploads to a workspace's private Hub repository when connected; do not execute untrusted model weights.
- Expose deployments through aliases. Gate promotion on evaluation and approval policy, check budgets before starts, and revoke routes and descendants through lineage.

## Consequences

Workspaces manage their own provider setup and external billing. Provider operations still depend on the connected service's availability, and budget reconciliation runs on a schedule rather than immediately.
