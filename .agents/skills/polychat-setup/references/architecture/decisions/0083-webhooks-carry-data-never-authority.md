# ADR 0083: Webhooks carry data, never authority

Status: Implemented for recipe installations.

## Problem

Recipes could only be started by a schedule, a person, or one of the providers Polychat already integrates (Composio, GitHub, channels, SMS). Anything else, such as a payment provider, a CI job, a home server or a no-code tool, had to be polled on a schedule or could not reach Polychat at all. A public endpoint that starts work is also an obvious way to smuggle instructions or authority into a run.

## Decision

A recipe installation may own any number of webhook triggers. Each is a row in the existing `event_subscription` table with broker `webhook`, so ownership, pause and the event receipt path are the ones Composio triggers already use (ADR 0019).

- The URL holds a random 256-bit token. Only its salted SHA-256 is stored, so the URL is shown once at creation and a lost URL is replaced by rotation, which retires the old one.
- `POST /webhooks/recipes/:token` accepts one JSON object of at most 16 KiB. `202` means the event was admitted, not that the recipe ran. Unknown tokens return `404`; paused webhooks or recipes return `409`.
- An optional `Idempotency-Key` header becomes the event identity, so a retried delivery reuses the same receipt and task instead of running twice. Without it every request is a new event.
- The payload is data. It reaches the recipe labelled as untrusted, cannot select tools or widen grants, and the run executes with the installation owner's current authority, rechecked after any condition is judged.
- Composio and webhook events share one admission path, so the natural-language condition, evaluation lease, receipt and deterministic task identity behave identically for both.

## Consequences

Anything that can send an HTTP request can start a recipe without a new integration, and a quiet hour still costs nothing. The URL is a bearer secret: anyone holding it can submit events, though never more than the recipe already does for its owner. Rotation does not cancel events already admitted. Per-address rate limiting applies to the public path as it does to other webhooks; per-webhook quotas and a personal inbound key for the Poly thread are separate decisions.
