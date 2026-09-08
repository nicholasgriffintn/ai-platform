# A workspace teammate every project gets

- **Change:** A workspace-owned teammate can be marked as a workspace default. Every project in that workspace then has it without being asked, and a project admin can remove it from one project without touching the workspace. Removal is recorded as an exclusion on the project rather than by deleting a grant that never existed. Migration `0038` adds `teammates.workspace_default` and `project_capability.excluded`.
- **Surfaces:** API. The teammate editor and project library read the new field; no UI toggle ships in this change.
- **Prerequisites:** Migration `0038`. Nothing becomes a default automatically.
- **Risk if wrong:** A teammate reaching a project that removed it, a project losing a teammate it attached itself, or an ordinary member changing what a workspace grants.
- **Commits:** This branch.

## Verify

- [x] Mark a workspace teammate as a default. Confirm it appears in every project in that workspace, including ones created before the change.
- [x] Remove it from one project as an admin. Confirm it disappears there and stays in the other projects and in the workspace.
- [x] Restore it to that project and confirm it returns.
- [x] As an ordinary project member, confirm removing a workspace teammate is refused.
- [x] Attach a teammate to a single project directly and confirm it is unaffected by the default rules.
- [x] Confirm a teammate that is both attached directly and a default is listed once.

**Stop and report if:** a project shows a teammate it removed, or a member without admin rights can change what the workspace grants.

## Additional automated service evidence — 8 September 2026

- `workspace-defaults.test.ts` exercises the production project teammate resolver with the same teammate attached directly and provided as a default; the result contains it exactly once. Mutation and cross-project persistence checks remain open.
- These tests passed in the existing 66-test service batch; no additional run was started.

## Browser and API evidence — 8 September 2026

- The channel-binding and workspace-default journeys passed in `test-results/container/b735eb00/results.json`. They exercise real API persistence, separate owner/member sessions, duplicate and scope refusals, removal and restoration, and project library visibility across existing and newly created projects.
