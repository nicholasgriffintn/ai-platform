# ADR 0092: Export Poly as a signed AIP bundle

Status: Implemented.

## Problem

People could export their chat history, but not the assistant they had built up: Poly's memory documents, their profile and the approvals they had granted. That state stayed locked in Polychat. It could not be read elsewhere, kept as a backup or compared after a change. Agent Identity Portability (AIP), a CC0 draft from Pulso, already describes a bundle for exactly this.

## Decision

`GET /poly/export` returns an AIP v0.1 bundle for the signed-in person's personal scope only. It carries a profile summary from their settings, their personal memory documents as persistent memories, their default model, and live standing approvals as auto-approved actions. The never-standing effect classes are listed as needing confirmation. Credentials, OAuth grants, payment details, conversations and project memory are never included, and the bundle says so in its metadata.

The identity, memory, configuration and learned behaviour sections are serialised as canonical JSON and signed with Ed25519. The signing key is derived from `PRIVATE_KEY` with HKDF under a purpose label, so the deployment needs no new secret and the public key is stable across exports. Without `PRIVATE_KEY` or `APP_BASE_URL` the export refuses rather than emit an unsigned bundle.

Import is out of scope. No other platform implements AIP yet, and restoring standing approvals from a file would bypass the rule that authority is granted in the app, not carried in.

## Consequences

People get a readable, verifiable copy of what Poly knows about them, alongside the chat history export. AIP is a one-vendor draft, so the mapping lives in one domain module and the internal models are unchanged. Rotating `PRIVATE_KEY` changes the signing key, so older bundles then verify only against the public key embedded in them. An import, if added, must restore approvals as suggestions, never as grants.
