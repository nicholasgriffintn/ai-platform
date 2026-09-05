# Project plans retain exact stage execution evidence

- **Change:** Project tasks snapshot their saved flow and derive each stage's state from exact runs, completions and outputs. Safe retries retain attempt provenance, while consumed external operations block blind reruns.
- **Surfaces:** API, Work web task detail and native iPhone task inbox detail.
- **Prerequisites:** Apply D1 migration `0029_dapper_alex_power.sql`. Use a project with a multi-stage saved flow, a current member on web and iPhone, and a connector action that can be safely verified in its provider.
- **Risk if wrong:** Plan prose may be presented as completed work, flow edits may rewrite history, a resumed stage may duplicate an external action, or former members may retain access.
- **Commits:** Uncommitted goal work.

## Verify

- [ ] Create a task from a saved flow and confirm every stage initially says proposed with no execution evidence. Edit the saved flow afterwards and confirm the existing task keeps its original stage names and order.
- [ ] Start the task and confirm the active stage says executing. Open its run from web and iPhone, then create a durable result and open that result from the same stage.
- [ ] Interrupt a stage, resume it and confirm both attempts remain visible with distinct run IDs, attempt numbers, terminal states and provenance; confirm only the attempt with a completion marks the stage complete.
- [ ] Fail a model-only stage and confirm Run again resumes the same snapshotted stage without removing the failed attempt.
- [ ] Consume approval for an external connector operation, interrupt or fail afterwards, and confirm Run again is blocked with instructions to reconcile the provider. Verify the provider receives no automatic duplicate write.
- [ ] Cancel a partially executed plan and confirm completed stages and results remain completed while untouched stages say abandoned. Confirm the task cannot be reopened or deleted and that changed work requires a new task.
- [ ] Cancel an untouched task and confirm it can return to the backlog or be deleted.
- [ ] Remove the tester's workspace membership and confirm task detail, run links, result links and retry actions no longer open. Restore membership and confirm access follows the current role.
- [ ] Open a task created before migration `0029` and confirm unattributed attempts appear under Task rather than being assigned to a current flow stage.

**Stop and report if:** a proposal appears executed without a run, a saved-flow edit rewrites an existing plan, an interrupted attempt disappears, an external action repeats without reconciliation, or lost membership still permits access or action.
