# Teammates replace agents in storage, the API and the web

- **Change:** The saved persona is a teammate everywhere. Migration `0033` renames the `agents`, `shared_agents`, `agent_installs` and `agent_ratings` tables and their id columns, and rewrites the `agent` project capability kind to `teammate`. The API serves `/teammates` and the editor moves to `/chat/teammates/:id` and the project equivalent. The old `/agents` route and editor paths are gone rather than aliased.
- **Surfaces:** Database, API and web app. iOS does not read these tables or routes.
- **Prerequisites:** Migration `0033` must run before the new code serves traffic. It renames tables in place, so a rollback needs the reverse rename, not a redeploy.
- **Risk if wrong:** A teammate list that comes back empty, a project losing its attached teammates, or a marketplace install pointing at nothing. Old `/agents` links are expected to break; that is the intended transition, not a regression.
- **Commits:** This branch.

## Verify

- [ ] After migrating, open Teammates and tools and confirm every teammate that existed before the change is listed, with its model, tools and skills intact.
- [ ] Open a project that had teammates attached and confirm they are still attached and still runnable, which proves the capability kind rewrite landed.
- [ ] Publish a teammate to a workspace, install a shared teammate, and rate one. Confirm each still works and that the install resolves back to its source listing.
- [x] Confirm the API answers at `/teammates` and returns 404 at `/agents`, and that nothing in this repository still calls the old path.
- [x] Mention a teammate in the composer with `@`, confirm the token renders and the reply comes from that teammate.
- [ ] Run `pnpm db:generate` and confirm it reports no schema changes, which proves the shipped snapshot matches the schema.

**Stop and report if:** any teammate, install, rating or project attachment is missing after the migration, or `db:generate` wants to create tables that already exist.

## Automated evidence — 7 September 2026

- `features/hire-teammate.spec.ts` confirms `/teammates` answers 200 and `/agents` answers 404 for a signed-in Pro account, and a repository search finds no remaining caller of the old path.
- The same journey creates a teammate, mentions it with `@` in the composer, and confirms the message is sent to `/teammates/:id/completions` and answered by that teammate.
- The journey selects the teammate from the `@` menu, confirms the token is applied, and confirms the reply is sent to that teammate. Still open: selecting the same menu entry with a real mouse click leaves the composer untouched; keyboard and synthetic-click selection pass.
- Fix: mentioning a teammate that pins no model sent an empty model to `/teammates/:id/completions` and was refused with 400 "Invalid model". The turn now falls back to the account default, and the journey uses a teammate with no pinned model so the fallback is what it proves.
- Left open: the migration itself, an existing project's attachments, publishing, installing and rating a shared teammate, and `db:generate` reporting no changes.
