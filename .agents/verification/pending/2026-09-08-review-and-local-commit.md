# Run review shows recorded validation evidence

- **Change:** Show bounded run diffs and recorded validation checks in the Workbench Changes pane. Remove the unused forge adapter and unwired desktop commit commands.
- **Surfaces:** Project Workbench run review.
- **Prerequisites:** A completed run with a diff and validation manifest.
- **Risk if wrong:** Reviewers could approve changes without seeing the evidence.

## Verify

- [ ] Open a completed run and select Changes; confirm the bounded diff, changed-file count, quality-gate result, and each recorded validation command/status are visible.
- [ ] Open a run without checks and confirm it says that no checks were recorded.

**Stop and report if:** the Changes pane hides validation evidence or reports checks that did not run.
