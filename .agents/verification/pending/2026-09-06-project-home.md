# A project opens on its conversations

- **Change:** A project lands on Chat, with Chat, Tasks and Files as tabs and a gear beside them. The six configuration cards move to a new `/work/:workspaceId/projects/:projectId/settings` route. The project actions menu keeps Save template and Archive, and drops its Tasks and Capabilities links now that the tabs and the sidebar carry them.
- **Surfaces:** Web app only. No API or contract change.
- **Prerequisites:** None.
- **Risk if wrong:** A project member unable to reach the brief, model tier, knowledge, schedules or coding environment, or a project that opens on an empty page.
- **Commits:** This branch.

## Verify

- [ ] Open a project. It shows the conversation starter and the full conversation list, not a wall of configuration, with Chat selected in the tabs.
- [ ] Move through Chat, Tasks and Files. The tab bar stays put, the selected tab follows the page, and each tab shows what it used to show.
- [ ] Open the gear. Confirm the brief, model tier, knowledge, schedules, coding environment and attached teammates and tools are all there and all still save.
- [ ] As a workspace member who is not an owner or admin, confirm the settings page is reachable and read-only where it was before, and that the actions menu is not offered.
- [ ] Save a template and archive a project from the actions menu, and confirm both still work.

**Stop and report if:** any configuration card is unreachable from the gear, or a project member sees settings they could not edit before.
