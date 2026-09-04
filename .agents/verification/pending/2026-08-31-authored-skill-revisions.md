# Authored skills are versioned, and old ones must be republished

- **Change:** An authored skill is now a D1 identity with immutable revisions and draft/stable pointers, with each revision stored as one immutable R2 bundle verified by digest. Draft, history, exact-revision, promote, rollback, and import operations exist on the API, and a turn records the exact revision it ran.
- **Surfaces:** web, API
- **Prerequisites:** migration `0007_foamy_harpoon`. **Skills stored in the old R2-only format are ignored by the new runtime and have to be republished by hand.**
- **Risk if wrong:** an authored skill silently stops loading, so a chat that depended on it changes behaviour with no error anywhere.
- **Commits:** `b0bb6c93` (#2152), `756e8255` (#2166), `3408bccb` (#2173). See ADR 0032.

## Verify

- [ ] List the authored skills that existed before this release, personal and project. Anything created under the old format will not appear once deployed.
- [ ] Republish each one that still matters, by recreating it through the current authoring flow. Keep the old content to hand until you have confirmed the new record works.
- [ ] Create a new authored skill, attach a resource file, save, and confirm it appears in the scope you created it in and nowhere else.
- [ ] Edit it and confirm the update takes effect in a new chat.
- [ ] Ask a chat something that should use the skill. Confirm it loads, and that the turn records which revision ran.
- [x] Exercise the lifecycle through the API, as there is no UI for it yet: `GET /v1/skills/documents/:id/revisions/:revisionId`, `POST .../promote`, `POST .../rollback`. Confirm promote only moves stable to the current draft, and that rollback creates a new revision rather than moving the pointer backwards. _(Local release E2Es cover personal and project documents, exact revisions, resources, promote and immutable rollback.)_
- [x] Archive a skill, then create a new one with the same name in the same scope. Confirm the name is free and the archived revisions still exist. _(Local release E2Es cover personal and project scopes.)_
- [x] As a project member who is not an owner or administrator, confirm you see the stable document only, and cannot read drafts or history. _(Local release E2E verifies the stable document and 403 responses for history and exact revisions.)_

**Stop and report if:** a skill that used to load no longer does and republishing does not fix it, or a revision read fails its digest check.
