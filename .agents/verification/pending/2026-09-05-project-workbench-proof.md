# Truthful Project Workbench Proof

- **Change:** Terminal sandbox runs now retain a structured Proof manifest with outcome, revisions, changes, validation, delivery, private artefacts, usage and incomplete-work evidence.
- **Surfaces:** Work project conversations on web, sandbox worker and API.
- **Prerequisites:** A Work project with a configured coding environment and repository access.
- **Risk if wrong:** A terminal run may show an incorrect outcome after reload, lose evidence or expose an unauthorised artefact link.
- **Commits:** None recorded.

## Verify

- [ ] Complete a coding run, reload the conversation and confirm Proof retains its completed outcome, revision, changed files, validation result and any branch or commit.
- [ ] Open a Proof artefact as a project member, then confirm a non-member cannot use the same Output URL.
- [ ] Run a task that fails validation and confirm Proof remains failed or records the failed quality gate without presenting missing evidence as success.
- [ ] Cancel a run, reload the conversation and confirm Proof remains cancelled with any available partial evidence and incomplete work.

**Stop and report if:** reload changes the terminal outcome, retry creates duplicate artefacts, a failed check appears passed, or an unauthorised user can read an artefact.
