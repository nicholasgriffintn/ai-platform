---
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-component-workspaces": minor
"@assistant/app": patch
"@assistant/desktop": patch
---

Give Work projects an overview page and consistent section navigation.

- The project home shows open tasks, with anything blocked or waiting for review listed first, plus a preview of the project brief beside its conversations. `ProjectTasksSummary` was already built but not used anywhere, and the brief was only visible in Settings.
- Project section tabs now read Overview · Tasks · Files · Activity, with a More menu for Teammates, Scheduled, Plugins and Settings, which were previously reachable only from the sidebar.
- The Activity page uses the shared project header, so its tabs match the other project pages. `ProjectActivity` now takes `workspaceId`.
- "Add a task" on the overview opens the task board with the create dialog already open (`?new=1`).
- `component-workspaces` exports a new `ProjectBriefPreview`.
- Teammates, Scheduled, Plugins and Settings now show the project tabs as well: `CapabilityLibrary`, `ScheduledLibrary` and `PluginsLibrary` accept an optional `navigation` slot. On Settings the tabs replace the "Back to project" link.
