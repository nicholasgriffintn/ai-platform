# A red build or requested changes on a teammate's pull request send the work back to its owner

- **Change:** the GitHub webhook now handles `check_run`, `check_suite`, `workflow_run` and `pull_request_review`. A task with a linked pull request records its CI state; the first failure on a commit and any "changes requested" review send a fix-up to the task's owner.
- **Surfaces:** API, web.
- **Prerequisites:** apply migration `0035_project_task_pull_request.sql`. In the GitHub App settings, grant **Checks: read** and **Actions: read**, and subscribe to **Check run**, **Check suite**, **Workflow run** and **Pull request review** events. Installations must accept the new permissions.
- **Risk if wrong:** red builds and requested changes go unnoticed, or a forged webhook nudges tasks it shouldn't.

## Verify

- [ ] On a Work task linked to a pull request in `nicholasgriffintn/ai-platform-sandbox-worker-tester` (ask the owner teammate to use `link_pull_request`), push a commit whose CI fails. The task thread shows "CI asked for a fix" with the failing check, the task returns to the backlog and its owner starts a run.
- [ ] Push a fix that passes. The thread shows "CI passed" and no further fix-up arrives.
- [ ] Request changes on the pull request in GitHub. The thread shows the review as a fix-up and the owner runs again with it.
- [ ] Approve or comment instead. Nothing is sent back.

**Stop and report if:** GitHub's webhook delivery log shows these events rejected, or a fix-up lands on a task in a workspace the installation's owner can't open.
