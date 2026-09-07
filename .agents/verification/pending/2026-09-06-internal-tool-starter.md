# A project can start with its teammates already hired

- **Change:** A "Build an internal tool" starter creates a project and hires the teammates it needs in the same step, rather than leaving an empty project and a list of things to wire up. Adds a Developer teammate role. Starters are listed at `GET /templates/starters` and started at `POST /templates/starters/:starterSlug/instantiate`, and appear on the workspace Governance page.
- **Surfaces:** API and web app. No schema change and no migration.
- **Prerequisites:** A Pro workspace where you are the owner or an admin.
- **Risk if wrong:** A starter hiring workspace teammates for somebody who is only a member, or a project created without the teammate it advertised.

## Verify

- [x] Open Governance in a workspace you own. Confirm the starter says when to reach for it and names the Developer it will hire.
- [x] Start it. Confirm you land on a new project, that the Developer is attached, and that the teammate exists in the workspace's teammates.
- [x] Confirm the project brief describes building small internal tools, and that the sandbox and document tools are enabled on it.
- [ ] Ask the Developer for a small tool. Confirm it can run a sandbox task and leave the result in the project's files.
- [ ] As a workspace member rather than an admin, confirm Governance does not offer starters and that starting one is refused.
- [x] Confirm an unknown starter slug is refused and no project is created.

**Stop and report if:** a workspace member can start a starter, or a project is created without the teammate the starter listed.

## Automated evidence — 7 September 2026

- New local Chromium `features/project-starters.spec.ts` opens Governance as the workspace owner and confirms the Build an internal tool card carries its when sentence and says it hires Developer.
- Starting it lands on a new project of that name whose settings show the brief about building small internal tools and a teammate count above zero, and the project library holds the Developer.
- Every tool the starter declares, including `run_sandbox_task` and `write_document`, comes back on the project through the API rather than being read off a card.
- Instantiating an unknown starter slug is refused with 404.
- The Start control now carries the starter name in its accessible name, so several starters can be told apart.
- Left open: asking the Developer for a tool and watching it run, and a plain member being refused starters.
