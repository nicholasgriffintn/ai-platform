# Verify the Project Workbench shell

- **Change:** Coding-enabled project conversations use a responsive Project Workbench shell with an API-backed status strip and Activity, Changes, Files and Proof panes.
- **Surfaces:** Work project conversations on web; Activity API reads.
- **Prerequisites:** A project with a configured coding environment and at least one sandbox run. Use a second project conversation without coding configuration for the ordinary-state check.
- **Risk if wrong:** People may lose conversation space, see stale run state or mistake local presentation state for execution authority.
- **Commits:** Uncommitted.

## Verify

- [x] Open a coding-enabled project conversation on a wide viewport. Confirm Conversation remains primary beside Activity, Changes, Files and Proof.
- [x] Resize and collapse the dock. Reload and confirm the selected pane, width and collapsed state return without changing run controls or authority.
- [ ] Use only the keyboard to switch panes and resize the dock. Confirm focus remains visible and a screen reader announces the run status, tab names and selected panel.
- [x] Narrow the viewport and open Workbench. Confirm the same four panes appear in a full-height dialog and closing it returns focus to the trigger.
- [ ] Observe queued, preparing, running, paused, waiting for approval, waiting for input, review, completed, failed and cancelled runs. Confirm the strip matches the API-backed run or task state and required input is prominent.
- [ ] Reload an active or historical coding conversation and confirm its latest authorised run returns. Remove coding configuration and confirm historical evidence remains readable.
- [x] Open a project conversation with no coding environment and no attached run. Confirm the ordinary Work conversation appears without disabled workbench controls.
- [ ] Give a run a long status detail and view it on desktop, tablet and mobile. Confirm the strip sits on the page background, the detail truncates, and the control labels collapse to icons with titles on narrow viewports.

**Stop and report if:** the shell appears for an ordinary project conversation, a reload loses authoritative run state, or a member can read activity outside their current project access.

**Local automated evidence:** `features/sandbox-layout.spec.ts` confirms the ordinary state, wide Conversation and all Workbench panes, keyboard resizing and pane navigation, persisted width, pane and collapsed state, and the mobile full-height dialog with focus returned to its trigger. Screen-reader output and the complete status matrix remain open.
