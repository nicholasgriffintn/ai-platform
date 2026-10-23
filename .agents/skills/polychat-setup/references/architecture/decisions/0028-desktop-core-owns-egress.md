# ADR 0028: Keep device access in the desktop core and share the app shell

Status: Implemented in `apps/desktop` and `packages/component-shell`.

## Problem

Local model runtimes and agent gateways need access to device addresses and credentials. Giving that access to the webview would widen its network boundary, while building a separate desktop shell would duplicate navigation and conversation behaviour.

## Decision

- Use the Tauri core for local providers, device egress and operating-system credentials. Keep device credentials out of the webview.
- Let the webview call the hosted API through the shared API client over HTTPS. The desktop content security policy allows only the required hosted API origin.
- Share navigation and product composition through `component-shell`. Keep host-only actions behind its host interface; ordinary component packages remain independent of routers, stores and API clients.
- Keep device model discovery and execution on the device. Apply account-scoped local storage and retention rules at the native host boundary.
- Keep local file effects in the Tauri core too. Hosted tools reach a granted folder only through a machine run that the desktop claims, and the core resolves every path inside the grant before it reads or writes. The heartbeat advertises folder ids and labels, never paths.

## Consequences

The desktop shares product navigation without giving browser code access to local services. Device capabilities and local history remain host-specific, while hosted conversations continue through the same API contracts as the web client.
