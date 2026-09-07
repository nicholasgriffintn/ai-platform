# ADR 0034: Advertise machines through a control plane that never carries content

Status: Implemented in the API, shared clients and desktop shell; the desktop application is not released.

## Problem

A desktop runtime is useful to every signed-in client belonging to the same account, but the control plane must not become a tunnel for local network access or conversation content. Clients also need a stable way to distinguish one advertised machine from another and to stop showing stale machines after a desktop exits.

## Decision

Store one account-scoped machine record per stable desktop machine ID. A heartbeat may contain only the user-visible machine label, platform, app version, runtime readiness, model metadata and declared capabilities. It never contains endpoint addresses, pairing secrets, prompts, responses, model bytes or workspace identifiers. The API authorises every read and write through the current account and never exposes machines through workspace routes.

Advertise on desktop launch, runtime changes and a two-minute interval. Derive `online` at read time from a five-minute `lastSeenAt` window rather than persisting presence. Sign-out and disabling the account setting forget the machine; an ungraceful exit becomes offline when the window expires.

The desktop keeps its local discovery source authoritative for itself, including while offline. Other signed-in clients fetch the account machines and merge ready model metadata into the catalogue with `machineId`. This advertises availability only; the control plane does not route execution, and clients must not send a machine model's prompt to the hosted API when no local execution path exists.

## Consequences

Browsers can show which account machines and models are currently reachable without learning how to reach a customer's network. The API has a small, inspectable persistence boundary and can forget a machine without touching conversations or provider credentials.

Remote machine models can be displayed before remote execution is available, so clients mark them non-executable and keep the execution guard explicit. The heartbeat interval is shorter than the freshness window, but network loss and process termination still leave a bounded period in which a machine appears online.
