# ADR 0049: Gate sandbox previews through current project authority

Status: Accepted and implemented.

A declared sandbox service is untrusted application content, but people need to review it without receiving a container address, durable-object identity or the Sandbox SDK's bearer URL. Publishing that URL directly would make possession of infrastructure state the authority and would bypass current project membership, service health and run lifecycle checks.

## Decision

Keep previews inside the existing sandbox runtime and `/apps/sandbox/runs/:runId` API surface. The API creates a short-lived preview session only after resolving the current member, project run, healthy declared service and exact declared port. It asks the sandbox Worker to expose that port through a 30-second signed service-binding grant, then stores the resulting private forwarding token in the run coordinator. The token and SDK URL never enter a browser response, run event or log.

Give each preview an opaque wildcard origin beneath `SANDBOX_PREVIEW_HOST`. A one-time 60-second bootstrap grant may establish a five-minute `HttpOnly`, `Secure`, host-only, partitioned cookie on that origin. Bind every grant to its preview, origin, member, project, run, service and port; accept only HS256 with the dedicated preview audience and exact purpose.

Authorise every HTTP request through the API service binding before forwarding it. The sandbox Worker authenticates to the normal API router as a short-lived, scope-limited service principal; the route then reconstructs the member from the preview grant, applies current workspace and project membership through the existing run access service, and compares the stored session with the current run, service health and declared port. Do not dispatch internal calls by invented URL origins or bypass the API middleware stack. Forward only through the Sandbox SDK's private preview protocol. Revoke coordinator sessions when the preview ends, the run becomes terminal or the service leaves healthy state; a membership loss denies the next request even if the local token has not expired.

Treat WebSocket handshakes and both message directions as authorised data transfers. Re-authorise before every forwarded message, cap message size and close at the absolute session expiry. An idle socket may remain connected until then, but cannot transfer data after membership, service or run authority is lost.

Strip browser authorisation, cookies, forwarding headers and SDK headers before the service request. Strip upstream cookies, CORS and identifying server headers from the response; replace them with no-store, no-referrer, restrictive permissions and an embedding policy limited to the configured Polychat origin. Rewrite only same-origin redirects or loopback redirects to the exact declared port, and reject every other redirect. Preview applications therefore cannot persist their own cookies through this gateway and may need repository configuration compatible with the restricted origin.

Preview access is a project-read capability. It does not grant runner controls, connector credentials, GitHub authority, command approval or browser automation. Web and iOS consume the same create, state and revoke meanings, while choosing their own presentation; this decision adds neither a Work mode nor a top-level route.

## Consequence

An authorised member can create and open a healthy declared service without learning the container boundary, while forged, replayed, expired, cross-origin, cross-project and stale-service access fails closed. Preview sessions are deliberately short and need replacement rather than renewal; applications that require external frames, broad cross-origin access or service-set cookies will be constrained. Runtime deployment additionally requires a wildcard preview route and matching host, parent origin, service binding and signing secret on the API and sandbox Worker.
