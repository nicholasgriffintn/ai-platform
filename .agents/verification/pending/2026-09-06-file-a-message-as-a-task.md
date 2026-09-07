# File what you type as a project task

- **Change:** A project conversation composer carries an "As task" toggle. With it on, sending files what you typed as a project task instead of asking it now, and the task records the conversation it came from. The task detail links back to that conversation. Coding conversations keep their existing task-type control instead.
- **Surfaces:** Web app and API. Migration `0034` adds `project_task.origin_conversation_id`.
- **Prerequisites:** Migration `0034`.
- **Risk if wrong:** A message silently lost instead of sent, a task filed against the wrong project, or the toggle appearing in a coding conversation where it would fight the task-type control.
- **Commits:** This branch.

## Verify

- [x] In an ordinary project conversation, turn on "As task", type an objective and send. Confirm the composer clears, a toast names the task, and the task appears on the board in Backlog.
- [x] Open that task. Confirm it says it was filed from a conversation and the link returns to the conversation you filed it from.
- [x] Turn the toggle off and send an ordinary message. Confirm it is answered as normal and no task is filed.
- [ ] Open a coding conversation for a project with a coding environment. Confirm the coding task-type control is there and the "As task" toggle is not.
- [x] File a task from a brand new conversation before it has any messages, and confirm the task is created without an origin rather than failing.
- [x] Create a task from the board. Confirm it has no origin conversation and the task detail does not show the link.

**Stop and report if:** a message disappears without either being answered or becoming a visible task, or a task is filed against a project the sender cannot access.

## Automated evidence — 7 September 2026

- New local Chromium `features/file-as-task.spec.ts` turns on As task in an ordinary project conversation, sends an objective, and confirms the composer clears, no completion request is made, and the objective appears on the board.
- Opening that task shows Filed from and its link returns to the project conversation it was filed from, where the toggle is off again and an ordinary message is answered normally without filing a second task.
- Filing from a conversation with no messages yet creates the task with no origin rather than failing, and a task created from the board carries no origin link either.
- The toast copy itself is not asserted; the board entry and the cleared composer are.
- Left open: a coding conversation showing the task-type control instead of the toggle.
