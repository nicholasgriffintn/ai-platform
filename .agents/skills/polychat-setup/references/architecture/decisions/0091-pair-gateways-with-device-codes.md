# ADR 0091: Pair gateways and CLIs with device codes

Status: Implemented.

## Problem

Gateways and CLIs authenticate with a personal API key. Getting one meant creating it in Profile, copying it and pasting it into a daemon on another machine. The key passed through a clipboard and often a terminal history, and nothing tied it to the machine that asked for it.

## Decision

Gateways and CLIs can pair through the RFC 8628 device authorisation flow. A client starts pairing with a display name and receives a high-entropy device code and an eight-letter user code from a 20-letter alphabet without vowels. The person signs in to the web app, enters or follows the user code, sees the client name and approves or denies it. A pending pairing expires after ten minutes and can be decided once.

Pairing state lives in the existing encrypted authentication challenge store, as `custom` challenges for the `device` provider. Each pairing holds three rows:

- **Code row:** keyed by a hash of the device code. Its attempt count paces polling.
- **Request row:** keyed by a hash of the user code. The approval page reads it, and deciding consumes it, so a code can be decided once.
- **Decision row:** written when the person approves or denies.

No codes are stored in plain text, and the person's identity is kept in the encrypted payload.

Approval issues nothing by itself. The client's next poll atomically consumes the decision and only then creates a personal API key named after the client. The plaintext key exists in exactly one response and is never stored, and it behaves like any other personal key: usage is attributed to the approver, and revoking it in Profile cuts the client off.

The token endpoint returns RFC 8628 error codes. It answers `slow_down` when a client has polled more often than once per interval since it started. The approval endpoints require a signed-in session and are protected by the existing CORS and CSRF rules. Starting a pairing clears expired device challenges.

## Consequences

Pasting keys still works, but the documented path for gateways is pairing. A client that loses its poll response after the decision is consumed must pair again, because the key is never shown twice. The endpoints accept JSON rather than form encoding, which clients written against the RFC's examples need to know. Scoped or expiring device keys would be a separate change to API keys, not to pairing.
