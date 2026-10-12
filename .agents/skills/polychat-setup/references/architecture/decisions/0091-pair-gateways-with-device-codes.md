# ADR 0091: Pair gateways and CLIs with device codes

Status: Implemented.

## Problem

Gateways and CLIs authenticate with a personal API key. Getting one meant creating it in Profile, copying it and pasting it into a daemon on another machine. The key passed through a clipboard and often a terminal history, and nothing tied it to the machine that asked for it.

## Decision

Gateways and CLIs can pair through the RFC 8628 device authorisation flow. A client starts pairing with a display name and receives a high-entropy device code, which is stored only as a hash, and an eight-letter user code from a 20-letter alphabet without vowels. The person signs in to the web app, enters or follows the user code, sees the client name and approves or denies it. A pending pairing expires after ten minutes and can be decided once.

Approval issues nothing by itself. The client's next poll atomically moves an approved pairing to consumed and only then creates a personal API key named after the client, so the plaintext key exists in exactly one response and is never stored. The key behaves like any other personal key: usage is attributed to the approver and revoking it in Profile cuts the client off.

The token endpoint returns RFC 8628 error codes and enforces the polling interval with `slow_down`. The default interval sits under the unauthenticated rate limit. The approval endpoints require a signed-in session and are protected by the existing CORS and CSRF rules.

## Consequences

Pasting keys still works, but the documented path for gateways is pairing. A client that loses its poll response after consumption must pair again, because the key is never shown twice. The endpoints accept JSON rather than form encoding, which clients written against the RFC's examples need to know. Scoped or expiring device keys would be a separate change to API keys, not to pairing.
