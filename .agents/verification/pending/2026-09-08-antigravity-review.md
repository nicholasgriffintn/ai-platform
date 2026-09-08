# Antigravity launches only from an approved workspace

- **Change:** Launch Antigravity from an approved Git directory, capture its starting head and dirty state, compare external edits against that head, and commit them through the reviewed desktop action.
- **Surfaces:** Desktop agent directory grants, Antigravity on macOS, and Git review/commit actions.
- **Prerequisites:** A macOS desktop build with Antigravity installed, a disposable Git directory selected through the desktop directory grant, and an intentional edit that can be reviewed.
- **Risk if wrong:** An external agent could open an unapproved path or commit edits that were not compared against the review base.
- **Commits:** `953abdf3b`, `1271027b4`, `1be669254`.

## Verify

- [ ] Grant a disposable Git directory and launch Antigravity; confirm the external app opens that directory and the result reports the starting head and dirty state.
- [ ] Revoke the directory grant and retry; confirm launch and comparison are refused rather than falling back to an arbitrary path.
- [ ] Make a small edit in Antigravity, compare against the captured base head, and confirm the changed filename and bounded diff are returned. Confirm an unchanged tree reports no changed files.
- [ ] Commit the reviewed edit with a valid message; confirm the local head advances and the commit contains only the intended change.
- [ ] Move the Git head after comparison, then retry commit; confirm the stale review is refused. Also confirm unsupported drivers and invalid messages are refused.

**Stop and report if:** Antigravity opens outside the approved grant, comparison omits an edit, or a stale review can still commit changes.
