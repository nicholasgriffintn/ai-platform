# Team agents are gone

- **Change:** Agent teams are deleted with no replacement and no shim. The `team_id`, `team_role` and `is_team_agent` columns are dropped, the three delegation tools and the nested delegation loop behind them are removed, `GET /v1/agents/teams` and `GET /v1/agents/teams/:teamId` are deleted, the delegation frame fields are gone from chat request options, and the web agent form loses its **Team** tab and team cards. Multi-agent work is a project flow in Work, and `run_council` or `second_opinion` in Chat.
- **Surfaces:** web, API
- **Prerequisites:** migration `0014_gigantic_vapor`, which drops the columns. There is no automatic migration from a team to a flow — the shapes do not correspond.
- **Risk if wrong:** anyone who built a team loses the sequencing, and any client still sending the removed request fields gets a rejection.
- **Commits:** part of `db886b1f` (#2182). See ADR 0037.

## Verify

- [ ] Before applying migration `0014` to production, list the agents that carried a `team_id` and keep that list. It is the only record of what a team contained once the columns are gone.
- [ ] After deploying, confirm the agents themselves survived — only the grouping and the delegation tools should have disappeared.
- [ ] Open the agent form. Confirm there is no Team tab, no team cards, and no leftover empty section where they were.
- [ ] Confirm `GET /v1/agents/teams` returns 404.
- [ ] Rebuild any sequencing you actually relied on as a project flow, deciding the stages by hand.
- [ ] Ask a chat to do something you would previously have delegated. Confirm `run_council` and `second_opinion` still work and return within the turn.
- [ ] Confirm a saved flow stage that still carries the `delegate` permission renders it as a ticked, labelled option you can clear, rather than hiding it.

**Stop and report if:** an agent record disappeared rather than just losing its team fields.
