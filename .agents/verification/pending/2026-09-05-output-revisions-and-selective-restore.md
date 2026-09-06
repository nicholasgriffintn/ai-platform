# Output revisions can be compared and safely restored

- **Change:** Output detail now compares earlier revisions with the current result and restores supported local text content by appending an auditable revision. Unsupported external or file-backed effects remain review-only.
- **Surfaces:** API, web output detail and native iOS output review.
- **Prerequisites:** Apply D1 migration `0028_boring_gateway.sql`. Use an output with at least two revisions; include a note or article result for restore and a sandbox, connector, publication or file-backed result for review-only behaviour.
- **Risk if wrong:** A stale writer could overwrite newer content, lost project access could expose history, provenance could be rewritten, or a local restore could be mistaken for reversal of an external action.
- **Commits:** Not committed.

## Verify

- [ ] Open an output with history on web, select an earlier revision and confirm the changed fields, both versions and the earlier revision's provenance are shown.
- [ ] Restore an earlier note or article revision and confirm a new current revision is appended with restored-from lineage; confirm earlier revisions remain available and status, sensitivity and provenance do not change.
- [ ] Open the same output review on iPhone through an output deep link and confirm the compact changed-field, title and provenance summary matches the server history.
- [ ] Change the output in another client before restoring and confirm the stale restore is rejected, current history reloads and newer content remains intact.
- [ ] Remove the tester's project membership and confirm project history and restore no longer open; restore membership and confirm access follows the current role.
- [ ] Review a sandbox, connector, publication, provider-job or file-backed output and confirm comparison remains available while restore is disabled with an external-effect explanation.
- [ ] For a project restore, inspect the workspace audit trail and confirm it records the actor, output, source revision and appended revision.

**Stop and report if:** history disappears after restore, content is overwritten without a conflict, provenance changes, lost membership still permits access, or any review-only result presents a local restore as reversing external work.
