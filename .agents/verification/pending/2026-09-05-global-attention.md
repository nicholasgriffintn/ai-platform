# Global Attention

- **Change:** Work now has one URL-filtered operational view derived from current task interactions and sandbox-run Activity across authorised workspaces.
- **Surfaces:** Work API and web.
- **Prerequisites:** Create two workspaces and projects with different members; prepare tasks or runs in approval, input, review, blocked, running, failed and recently completed states.
- **Risk if wrong:** Work is omitted, misclassified or disclosed after membership is removed.
- **Commits:** none recorded.

## Verify

- [ ] Open `/work/attention`; confirm each eligible state appears once in descending time and stable identity order, task and run links return to their existing detail surfaces, and the empty state explains both an empty account and an over-narrow filter.
- [ ] Apply every state, workspace, project, owner, type and inclusive date filter. Reload and share the URL; confirm the same filters and page return, invalid combinations fail safely to the default view, and Clear filters resets the offset.
- [ ] Create more than one page of items with equal timestamps. Move forwards and backwards and confirm deterministic order, accurate totals and no unbounded page rendering.
- [ ] Pause a run, request a command approval, resolve it and let another approval expire. Confirm pause remains Running, pending approval appears as Needs approval, resolution returns it to Running and an item older than the maximum approval window becomes Failed or stalled.
- [ ] Remove the current user from one workspace while the view is open, then refresh. Confirm that workspace's items, projects and owners disappear and its detail links reject access.
- [ ] Confirm project task badges and workspace summaries continue to show their task-only counts rather than counting running or recently completed sandbox runs.

**Stop and report if:** an unauthorised workspace appears in results or facets, prose creates an item, filters return work outside their requested scope, or navigating from Attention bypasses an existing authority check.
