# A project can start with its teammates already hired

- **Change:** A "Build an internal tool" starter creates a project and hires the teammates it needs in the same step, rather than leaving an empty project and a list of things to wire up. Adds a Developer teammate role. Starters are listed at `GET /templates/starters` and started at `POST /templates/starters/:starterSlug/instantiate`, and appear on the workspace Governance page.
- **Surfaces:** API and web app. No schema change and no migration.
- **Prerequisites:** A Pro workspace where you are the owner or an admin.
- **Risk if wrong:** A starter hiring workspace teammates for somebody who is only a member, or a project created without the teammate it advertised.

## Verify

- [ ] Open Governance in a workspace you own. Confirm the starter says when to reach for it and names the Developer it will hire.
- [ ] Start it. Confirm you land on a new project, that the Developer is attached, and that the teammate exists in the workspace's teammates.
- [ ] Confirm the project brief describes building small internal tools, and that the sandbox and document tools are enabled on it.
- [ ] Ask the Developer for a small tool. Confirm it can run a sandbox task and leave the result in the project's files.
- [ ] As a workspace member rather than an admin, confirm Governance does not offer starters and that starting one is refused.
- [ ] Confirm an unknown starter slug is refused and no project is created.

**Stop and report if:** a workspace member can start a starter, or a project is created without the teammate the starter listed.
