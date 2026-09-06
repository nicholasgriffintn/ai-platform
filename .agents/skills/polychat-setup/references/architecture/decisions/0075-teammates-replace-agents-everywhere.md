# ADR 0075: Teammates replace agents everywhere

Status: Accepted.

The product called a saved persona a teammate while the code, the API and the database called it an agent. Every file had to translate between the two, and the word "agent" also names three unrelated things in this codebase: the turn engine's loop, the execution modes it runs in, and the run traces it records. Keeping one word for four concepts is what made the surface hard to learn in the first place.

## Decision

The saved persona is a teammate in every layer: `teammates`, `shared_teammates`, `teammate_installs` and `teammate_ratings` in storage, `teammate_id` and `derived_from_teammate_id` on their foreign keys, `teammate` as the project capability kind, `/teammates` on the API, `/chat/teammates/:id` on the web, and teammate throughout the contracts, services, hooks and components. There is no `/agents` alias and no redirect from the old editor paths: a half-migrated surface is the thing this record exists to remove, so the transition is complete and old links break.

Three things keep the name agent, because they are not the persona. The turn engine in `lib/chat/agent` and `library-agent-core` runs an agent loop. `AgentMode` and the `agent` chat mode name an execution mode, shared with plan, build and explore, and the mode value is persisted in browser storage. Agent traces record what that loop did. The `Agent Skills` document format is an external name.

## Trade-off

Renaming four tables and five columns is a data migration, and `drizzle-kit generate` resolves renames through an interactive prompt that needs a TTY, which CI and agent sessions do not have. Rather than leave storage on the old names, the rename ships as an authored `ALTER TABLE ... RENAME` migration paired with a snapshot generated from the schema through drizzle's own `generateSQLiteDrizzleJson`, so `db:generate` reports no pending diff afterwards. Every other schema change still goes through `db:generate` unchanged; a future rename needs the same one-off treatment, run from a terminal.

Renaming the capability kind updates existing project rows in the same migration. Anything that stored the literal `agent` outside those tables, such as an exported project template written before this change, keeps the old value and will not match. Bookmarked `/chat/agents/:id` links and any client still calling `/agents` stop working at the deploy.
