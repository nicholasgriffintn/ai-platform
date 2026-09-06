# File what you type as a project task

- **Change:** A project conversation composer carries an "As task" toggle. With it on, sending files what you typed as a project task instead of asking it now, and the task records the conversation it came from. The task detail links back to that conversation. Coding conversations keep their existing task-type control instead.
- **Surfaces:** Web app and API. Migration `0034` adds `project_task.origin_conversation_id`.
- **Prerequisites:** Migration `0034`.
- **Risk if wrong:** A message silently lost instead of sent, a task filed against the wrong project, or the toggle appearing in a coding conversation where it would fight the task-type control.
- **Commits:** This branch.

## Verify

- [ ] In an ordinary project conversation, turn on "As task", type an objective and send. Confirm the composer clears, a toast names the task, and the task appears on the board in Backlog.
- [ ] Open that task. Confirm it says it was filed from a conversation and the link returns to the conversation you filed it from.
- [ ] Turn the toggle off and send an ordinary message. Confirm it is answered as normal and no task is filed.
- [ ] Open a coding conversation for a project with a coding environment. Confirm the coding task-type control is there and the "As task" toggle is not.
- [ ] File a task from a brand new conversation before it has any messages, and confirm the task is created without an origin rather than failing.
- [ ] Create a task from the board. Confirm it has no origin conversation and the task detail does not show the link.

**Stop and report if:** a message disappears without either being answered or becoming a visible task, or a task is filed against a project the sender cannot access.
