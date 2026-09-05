# Durable project-task ownership

- **Change:** queue-dispatched stored project tasks now have renewable, persisted execution ownership and recover from safe run checkpoints after Worker loss.
- **Surfaces:** Work project tasks, task queue, chat run lifecycle, usage reservations and connector cleanup.
- **Prerequisites:** apply generated D1 migrations `0021_late_grandmaster.sql` and `0022_eager_cargill.sql`; configure the task queue and conversation coordinator bindings from `wrangler.jsonc.example`.
- **Risk if wrong:** a redelivery may compete with a live owner, repeat an external write, strand credits or present a dead interaction as actionable.
- **Commits:** none yet.

## Verify

- [ ] Start a multi-step project task, close the initiating client immediately, and confirm the queue-owned task continues to a persisted terminal or waiting run without the request remaining open.
- [ ] Hold one delivery beyond a queue redelivery and confirm the second delivery retries while the first owner lease is live; confirm only one project-task settlement is committed.
- [ ] Terminate a Worker after the run reaches `running` but before a safe checkpoint. Confirm redelivery records `interrupted`, blocks the project task, and does not repeat the model/tool step automatically.
- [ ] Terminate after the run persists `succeeded`, `awaiting_input` or `awaiting_approval` but before project-task settlement. Confirm redelivery reconciles the saved result or interaction without another model/tool invocation.
- [ ] Recover a waiting interaction inside seven days and confirm it remains actionable. Repeat with an interaction older than seven days and confirm it becomes resolved as expired and the run fails visibly.
- [ ] Force owner loss after credit reservation and connector-session creation. Confirm the `chat_run` reservation is released and connector sessions enter the existing cleanup queue.
- [ ] Revoke the runner's workspace membership before delivery and confirm policy blocks execution without model/tool work.
- [ ] Confirm a personal stored Chat still reports best-effort connection recovery and a local-only Chat creates no server run, queue task or durable reservation.

**Stop and report if:** two owners commit, a redelivery repeats an external write, a lost owner leaves reserved credits, an expired interaction remains clickable, or local-only content reaches server storage.
