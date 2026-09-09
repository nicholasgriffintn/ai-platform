# Project plans retain exact stage execution evidence

- **Change:** Project tasks snapshot their saved flow and derive each stage's state from exact runs, completions and outputs. Safe retries retain attempt provenance, while consumed external operations block blind reruns.
- **Surfaces:** API, Work web task detail and native iPhone task inbox detail.
- **Prerequisites:** Apply D1 migration `0029_dapper_alex_power.sql`. Use a project with a multi-stage saved flow, a current member on web and iPhone, and a connector action that can be safely verified in its provider.
- **Risk if wrong:** Plan prose may be presented as completed work, flow edits may rewrite history, a resumed stage may duplicate an external action, or former members may retain access.
- **Commits:** Uncommitted goal work.

## Verify

- [x] Create a task from a saved flow and confirm every stage initially says proposed with no execution evidence. Edit the saved flow afterwards and confirm the existing task keeps its original stage names and order.
- [ ] Start the task and confirm the active stage says executing. Open its run from web and iPhone, then create a durable result and open that result from the same stage.
- [x] Interrupt a stage, resume it and confirm both attempts remain visible with distinct run IDs, attempt numbers, terminal states and provenance; confirm only the attempt with a completion marks the stage complete.
- [ ] Fail a model-only stage and confirm Run again resumes the same snapshotted stage without removing the failed attempt.
- [x] Consume approval for an external connector operation, interrupt or fail afterwards, and confirm Run again is blocked with instructions to reconcile the provider. Verify the provider receives no automatic duplicate write.
- [x] Cancel a partially executed plan and confirm completed stages and results remain completed while untouched stages say abandoned. Confirm the task cannot be reopened or deleted and that changed work requires a new task.
- [x] Cancel an untouched task and confirm it can return to the backlog or be deleted.
- [ ] Remove the tester's workspace membership and confirm task detail, run links, result links and retry actions no longer open. Restore membership and confirm access follows the current role.
- [x] Open a task created before migration `0029` and confirm unattributed attempts appear under Task rather than being assigned to a current flow stage.

**Stop and report if:** a proposal appears executed without a run, a saved-flow edit rewrites an existing plan, an interrupted attempt disappears, an external action repeats without reconciliation, or lost membership still permits access or action.

## Automated evidence — 6 September 2026

`features/project-tasks.spec.ts` passed locally against the real app/API and isolated D1. It creates a two-stage pipeline and backlog task, changes the saved pipeline, and confirms the task's original names and order survive reload with zero attempts or run links. Cancellation marks both untouched stages abandoned, reopening restores proposed state, and cancelling again allows deletion.

## Further automatic validation — 8 September 2026

- The passing plan-evidence tests cover consumed-operation retry refusal; the project-task start path checks resume.supported before dispatch. Source review confirms missing stage IDs remain in a separate Task stage rather than being attached to the current flow. These are boundary/source checks rather than an external connector invocation.

## Retained attempt evidence — 9 September 2026

- Inspected the passing `plan-evidence.test.ts` from the 2,082-test API batch: interrupted run-2/attempt 1 and succeeded run-3/attempt 2 remain at the same stage; only the latter links its completion. Durable outputs require matching run provenance. This verifies server evidence projection; physical iPhone navigation remains outside this result.

- The expanded plan-evidence batch passes four tests (`/tmp/polychat-plan-cancellation-validation.log`): cancellation preserves the completed stage and failed-stage output, and marks the untouched stage abandoned. Existing passing project-task tests reject reopening an executed cancelled task, changing its objective or deleting a task with execution evidence.
