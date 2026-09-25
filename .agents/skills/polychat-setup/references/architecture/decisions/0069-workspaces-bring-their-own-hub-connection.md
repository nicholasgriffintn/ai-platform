# ADR 0069: Let workspaces bring their own Hugging Face connection

Status: Accepted.

## Problem

Fine-tunes, output repositories and Inference Endpoints are created under a Hugging Face account and billed there. A single platform token in the API and training worker makes every workspace train and deploy under the operator's organisation, with the operator's quota and bill. Workspaces also need their own token to reach gated or private repositories they have accepted terms for.

## Decision

A workspace admin connects Hugging Face under Models › Govern. They paste a token, Polychat checks it against the Hub's whoami endpoint, and they pick the account or organisation that owns the work and an endpoint location. The token is sealed with the server key in `workspace_provider_connection` and never returned to clients. Saving without a token keeps the stored one, so admins can change the organisation or location without pasting it again.

Every registry call resolves credentials per workspace: the workspace connection first, then the platform `HUGGINGFACE_*` variables as a global default. The API passes resolved credentials to the training worker through service-binding props, so the worker holds no per-workspace state. Search and import work without write access. Builds and deployments need a token that can write to the chosen namespace, and return a 409 that points to Govern when it is missing.

## Consequences

Retiring a route that owns an endpoint now deletes the endpoint with the workspace's credentials. Disconnecting a workspace leaves existing endpoints running under its organisation until they are retired or removed on the Hub. The connection table is keyed by provider, so other training or serving providers can follow the same pattern without a new table.
