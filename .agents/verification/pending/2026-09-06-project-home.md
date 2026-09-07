# A project opens on its conversations

- **Change:** A project lands on Chat, with Chat, Tasks and Files as tabs and a gear beside them. The six configuration cards move to a new `/work/:workspaceId/projects/:projectId/settings` route. The project actions menu keeps Save template and Archive, and drops its Tasks and Capabilities links now that the tabs and the sidebar carry them.
- **Surfaces:** Web app only. No API or contract change.
- **Prerequisites:** None.
- **Risk if wrong:** A project member unable to reach the brief, model tier, knowledge, schedules or coding environment, or a project that opens on an empty page.
- **Commits:** This branch.

## Verify

- [x] Open a project. It shows the conversation starter and the full conversation list, not a wall of configuration, with Chat selected in the tabs.
- [x] Move through Chat, Tasks and Files. The tab bar stays put, the selected tab follows the page, and each tab shows what it used to show.
- [ ] Open the gear. Confirm the brief, model tier, knowledge, schedules, coding environment and attached teammates and tools are all there and all still save.
- [x] As a workspace member who is not an owner or admin, confirm the settings page is reachable and read-only where it was before, and that the actions menu is not offered.
- [x] Save a template and archive a project from the actions menu, and confirm both still work.

**Stop and report if:** any configuration card is unreachable from the gear, or a project member sees settings they could not edit before.

## Automated evidence — 7 September 2026

- `features/places.spec.ts` opens a project, confirms Chat is the current tab, moves through Tasks and Files, and opens the gear to `/settings`, where the brief, default model tier, project memory, scheduled recipes, coding repository and teammates cards all render.
- `features/work.spec.ts` confirms an invited member can open the settings route, sees the model tier disabled, and is not offered the project actions menu; the governed-template journey still saves a template, instantiates it and archives the project from that menu.
- Left open: saving from the knowledge and teammates cards. Brief, model tier, schedules and coding environment saves are exercised by their own journeys.
