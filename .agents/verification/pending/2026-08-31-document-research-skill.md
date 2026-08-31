# New built-in skill: document research

- **Change:** A `document-research` skill ships in the built-in catalogue, so a chat can load it and follow a documented research procedure over uploaded documents.
- **Surfaces:** web, iOS, API
- **Prerequisites:** none beyond the release prerequisites. It leans on document retrieval, so check `2026-08-31-embedding-lifecycle.md` first.
- **Risk if wrong:** the skill loads but its instructions do not match how retrieval now works, so answers get confidently worse.
- **Commits:** `b743095a` (#2148)

## Verify

- [ ] Confirm `document-research` appears in the skills catalogue in both personal and project scope.
- [ ] Upload a document, then ask a research question that should trigger the skill. Confirm it loads and the answer cites the document.
- [ ] Read the answer against the source. The skill is new, so judge whether its procedure actually produces better research, not only that it ran.
- [ ] Ask the same question with no documents uploaded. Confirm it says so rather than inventing sources.

**Stop and report if:** the skill loads but its steps reference retrieval behaviour the platform no longer has.
