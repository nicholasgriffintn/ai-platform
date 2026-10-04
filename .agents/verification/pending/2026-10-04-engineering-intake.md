# Import issues and publish commit-bound PR reviews

- **Change:** bring GitHub or Linear issues into Work tasks and review GitHub PR revisions through the existing task runner.
- **Surfaces:** Work Tasks on web and desktop; project APIs and GitHub webhook.
- **Prerequisites:** apply migration `0058_project_task_integrations`; configure the task queue and model access. Connect a GitHub App with contents/issues/pull-request read permissions and pull-request write permission for publication. Configure a webhook secret and pull-request events for automatic intake. Connect Linear through Composio for Linear imports.
- **Risk if wrong:** intake fails, pending reviews spend budget after policy changes, or publication targets the wrong revision.
- **Commits:** see the engineering integrations PR.

## Verify

- [ ] Import an issue, edit its objective and criteria, and observe the retained snapshot and backlog task. Re-import it and open the same task. Change an unimported issue after preview and observe a conflict requiring another preview.
- [ ] Start a PR review and observe a governed Output identifying the commit pair and omitted patches. Confirm that repository code is not executed.
- [ ] Enable automatic intake, deliver a ready PR revision twice and observe one task. Push another commit and observe new work. Disable the policy before dispatch and observe the pending automatic task blocked.
- [ ] Preview and edit publication text, approve it, and observe one GitHub comment review on the captured commit. Advance the PR before approving another review and observe publication refused.
- [ ] With a non-production account, simulate a lost publication response and use Check publication in GitHub. Confirm that reconciliation reads the existing review and does not post again.
- [ ] Revoke the selected connection or project access and observe intake/publication denied. Disable automation after revocation without needing the revoked connection.

**Stop and report if:** another account's connection is accepted, a duplicate write occurs, or the published review claims a commit that was not captured.

Automated checks cover local migration behaviour, duplicate intake, revision drift, authority checks and uncertain publication. Live GitHub/Linear execution and deployed bindings require operator verification.
