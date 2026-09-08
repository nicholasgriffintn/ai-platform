# Run review evidence fences local commits

- **Change:** Show bounded run diffs and recorded validation checks in the Workbench Changes pane, provide a forge adapter seam, and commit reviewed local changes only when the reviewed base is still current.
- **Surfaces:** Project Workbench run review, desktop agent workspace actions, and forge delivery integration.
- **Prerequisites:** A completed run with a diff and validation manifest, plus a disposable approved Git directory containing an intentional uncommitted change.
- **Risk if wrong:** Reviewers could approve changes without seeing the evidence, or a later edit could be committed under an outdated review.
- **Commits:** `f4de1e7a3`, `8da495ec1`, `1be669254`.

## Verify

- [ ] Open a completed run and select Changes; confirm the bounded diff, changed-file count, quality-gate result, and each recorded validation command/status are visible. Open a run without checks and confirm it says that no checks were recorded.
- [ ] Review the disposable workspace, commit with a non-empty message, and confirm only the intended changes are committed and the returned commit head advances from the reviewed base.
- [ ] Change the workspace head after review but before commit; confirm the commit action refuses the stale review and does not create another commit.
- [ ] Try an empty workspace and an empty or overlong commit message; confirm each is refused with no repository change.
- [ ] Exercise the GitHub forge adapter against a disposable repository or controlled mock; confirm create/get pull-request responses preserve repository, number, URL, head, and base.

**Stop and report if:** the Changes pane hides validation evidence, a stale base can be committed, invalid commit messages mutate the repository, or forge responses lose their identifying fields.
