# Agents got a real contract, an owning scope, and skills

- **Change:** The agents API now returns a validated response with parsed arrays instead of raw D1 rows, so `servers`, `few_shot_examples` and `enabled_tools` arrive as arrays. A saved agent is owned by a scope rather than one user, so a project can attach an agent any member can see and repair. An agent can now name skills and pick a mode, streams like any other turn, and is published as a capability. Deleting an agent a project capability or flow stage still references is refused. The dead `headers` and `env` fields were dropped from the MCP server schema — they stored plaintext secrets in D1 and nothing read them.
- **Surfaces:** web, API
- **Prerequisites:** migrations `0011`, `0012` (backfills owner scope from `user_id`), and `0013`.
- **Risk if wrong:** an existing agent loses its tools, its servers, or its owner, and a project flow that names it stops running.
- **Commits:** `a7342e67` (#2179), `bf9cd2d2` (#2180), `db886b1f` (#2182). See ADR 0036.

## Verify

- [ ] Open each agent you already had. Confirm its name, prompt, tools, few-shot examples, and MCP servers all survived the migration and render as lists rather than raw JSON.
- [ ] Confirm any agent that carried MCP server `headers` or `env` values still connects. Those fields are gone; if a server needed them, it needs another route to its credentials.
- [ ] Run a saved agent from chat. Confirm it streams rather than arriving in one block, and that it uses the tools the agent declares rather than none.
- [ ] Create an agent in a project. Confirm a second workspace member can see, edit, and run it.
- [ ] Attach skills to an agent and pick a non-default mode. Confirm both take effect in a run.
- [ ] Try to delete an agent a project capability or flow stage references. Confirm the refusal names what depends on it.
- [ ] Delete an agent nothing references. Confirm it goes, and that any shared listing for it disappears too.
- [ ] Confirm agents appear where capabilities are listed, in both personal and project scope.

**Stop and report if:** an agent that ran before this release now runs with no tools, or a project flow stage cannot resolve its agent.
