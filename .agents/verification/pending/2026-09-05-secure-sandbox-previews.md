# Secure sandbox service previews

- **Change:** Healthy declared project services can receive short-lived access through an isolated preview origin without exposing Sandbox infrastructure authority.
- **Surfaces:** Work API and sandbox Worker.
- **Prerequisites:** Deploy matching API and sandbox Worker revisions; set the same strong `JWT_SECRET` and `SANDBOX_PREVIEW_HOST`; preserve the `SANDBOX_WORKER` and `POLYCHAT_API` service bindings; route `*.<SANDBOX_PREVIEW_HOST>/*` to the sandbox Worker with wildcard DNS and TLS; set the Worker's `APP_BASE_URL` to the exact trusted Polychat origin; start a project coding run with a healthy declared HTTP service on a non-3000 port.
- **Risk if wrong:** An authorised member cannot review a service, or a stale, forged or unauthorised request reaches private run content.
- **Commits:** none recorded.

## Verify

- [ ] As a current project member, create access with `POST /apps/sandbox/runs/:runId/previews`; confirm the response reports `healthy` and gives a one-time URL on an opaque preview subdomain, not a Sandbox SDK URL, container address or storage identifier.
- [ ] Open that URL once; confirm it redirects to `/`, sets a `Secure`, `HttpOnly`, host-only, partitioned preview cookie, and renders the declared service through the opaque origin.
- [ ] Confirm proxied responses are `no-store`, restrict framing to the configured Polychat origin, omit upstream `Set-Cookie` and identifying server headers, and reject a redirect to any external host or undeclared port.
- [ ] Replay the bootstrap URL, alter its signature or subdomain, substitute another project or run identifier, and request an undeclared or unhealthy service; confirm every request fails without preview content.
- [ ] Call `POST /apps/sandbox/previews/authorise` without a valid `sandbox-preview:authorise` service principal and confirm it returns no forwarding token or preview content.
- [ ] Revoke the preview through `DELETE /apps/sandbox/runs/:runId/previews/:previewId`; confirm subsequent HTTP and WebSocket data transfer is denied. Repeat after stopping or restarting the service, completing or cancelling the run, removing project membership and waiting beyond the five-minute expiry.
- [ ] Review API, sandbox Worker and Sandbox SDK logs for these attempts; confirm they contain no grant, cookie, forwarding token, SDK URL, connector credential or container address.

**Stop and report if:** any unauthorised request returns service content, an active WebSocket transfers data after authority is removed, an external redirect succeeds, or a browser/log response reveals private forwarding or container details.
