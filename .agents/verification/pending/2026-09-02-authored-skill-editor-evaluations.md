# Edit and test authored skill drafts before making them live

- **Change:** Skill owners can edit instructions, compare immutable revisions, run isolated draft evaluations, save repeatable cases, inspect exact result provenance, promote a draft, and restore an earlier version as a new draft.
- **Surfaces:** web, API
- **Prerequisites:** none
- **Risk if wrong:** a draft could affect live conversations early, a project member could reach administration controls, or a result could be recorded against the wrong revision.
- **Commits:** pending

## Verify

- [ ] In Chat → Capabilities, open a personal authored skill, change its instructions, and save. Confirm the draft revision changes while the live revision and an existing conversation continue to use the previous instructions.
- [ ] Run an ad-hoc test and a saved repeatable case. Confirm each result shows the exact draft revision, model, input, outcome, author, and time; delete the saved case and confirm it disappears.
- [ ] Compare two revisions, restore the earlier one, and confirm Polychat creates a new draft rather than rewriting history. Make it live and confirm the readiness label changes to “Live revision”.
- [ ] Repeat the workflow in a Work project as an owner or administrator. Then open the editor URL as a project member and confirm the page is unavailable and the APIs return 403.
- [ ] Trigger a model/provider failure during a test and confirm the draft remains unchanged, no result is saved, and the editor shows the error.

**Stop and report if:** a test creates a conversation, enables tools, changes the live revision, exposes the editor to a project member, or records a result under a different revision.
