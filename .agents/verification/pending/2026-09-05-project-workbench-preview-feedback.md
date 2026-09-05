# Project Workbench preview feedback

- **Change:** Project Workbench can present a declared service in a responsive Preview pane and submit bounded review context through the existing run instruction path.
- **Surfaces:** Work web application and existing sandbox preview API.
- **Prerequisites:** Complete the secure preview gateway verification; start a project conversation run as its runner with a healthy declared HTTP service; sign in separately as another current project member.
- **Risk if wrong:** Untrusted application content appears to be Polychat control chrome, feedback loses its route or actor, or a stale preview gains execution authority.
- **Commits:** none recorded.

## Verify

- [ ] Open Preview at wide and narrow sizes; confirm Conversation remains the primary surface, the pane remains keyboard reachable and Fit, Mobile, Tablet and Desktop presets constrain only the untrusted frame.
- [ ] Confirm loading, starting, healthy, unhealthy, expired and stopped states use API service and preview state, and that refresh creates replacement access rather than extending an expired session.
- [ ] Navigate with the trusted route field, open externally and mark a region. Confirm the application frame cannot cover, imitate or invoke the trusted controls, navigate the parent, read Polychat credentials or submit feedback itself.
- [ ] As the initiating runner, add an optional element reference and annotation. Confirm Activity restores one ordinary `message` instruction containing the service, route, viewport, normalised region and feedback, attributed to that user after reload.
- [ ] As another project member, confirm the preview remains reviewable but feedback and run controls remain disabled. Confirm removing membership or stopping the service makes both embedded and external access fail safely.
- [ ] Confirm no screenshot bytes, preview cookie, bootstrap grant, forwarding token, container address or DOM selector is written to conversation, Activity, browser logs or API logs.

**Stop and report if:** preview content gains trusted control placement or parent-page authority, feedback can be forged by the frame or submitted by a non-runner, duplicate instructions appear, or stale access continues after authority is removed.
