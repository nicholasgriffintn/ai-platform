# Teammates replace agents in storage, the API and the web

- **Change:** The saved persona is a teammate everywhere. Migration `0033` renames the `agents`, `shared_agents`, `agent_installs` and `agent_ratings` tables and their id columns, and rewrites the `agent` project capability kind to `teammate`. The API serves `/teammates` with `/agents` still answering, and the editor moves to `/chat/teammates/:id` and the project equivalent, with the old paths redirecting.
- **Surfaces:** Database, API and web app. iOS does not read these tables or routes.
- **Prerequisites:** Migration `0033` must run before the new code serves traffic. It renames tables in place, so a rollback needs the reverse rename, not a redeploy.
- **Risk if wrong:** A teammate list that comes back empty, a project losing its attached teammates, a marketplace install pointing at nothing, or an old link 404ing.
- **Commits:** This branch.

## Verify

- [ ] After migrating, open Teammates and tools and confirm every teammate that existed before the change is listed, with its model, tools and skills intact.
- [ ] Open a project that had teammates attached and confirm they are still attached and still runnable, which proves the capability kind rewrite landed.
- [ ] Publish a teammate to a workspace, install a shared teammate, and rate one. Confirm each still works and that the install resolves back to its source listing.
- [ ] Open an old `/chat/agents/<id>` link and an old project `/agents/<id>` link and confirm both redirect to the teammate editor with the record loaded.
- [ ] Call the API at `/agents` and at `/teammates` with the same credentials and confirm both return the same list.
- [ ] Mention a teammate in the composer with `@`, confirm the token renders and the reply comes from that teammate.
- [ ] Run `pnpm db:generate` and confirm it reports no schema changes, which proves the shipped snapshot matches the schema.

**Stop and report if:** any teammate, install, rating or project attachment is missing after the migration, or `db:generate` wants to create tables that already exist.
