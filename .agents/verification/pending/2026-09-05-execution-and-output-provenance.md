# Execution and output provenance

- **Change:** Stored runs and durable outputs now retain bounded effective model/provider, skill revision, source and approval provenance. Web output detail and web/iPhone run context expose the same origin facts without mutable-default lookups.
- **Surfaces:** API, web Chat and outputs, native iPhone Chat.
- **Prerequisites:** Apply migration `0027_flippant_whistler.sql`. Use an account with a stored chat run, at least one loaded skill, an attached source and an approval-producing tool. Keep a legacy output created before the migration for compatibility checks.
- **Risk if wrong:** Old results may appear to come from current settings, provenance may leak across scopes, deleted sources may imply continuing access, or prompt/tool secrets may be copied into durable records.
- **Commits:** Uncommitted goal work.

## Verify

- [ ] Create an output from a stored run, including a model handoff. Confirm web output detail and iPhone Run Context show the model and provider actually used, the exact run attempt, loaded skill revision and approval outcome rather than the composer default.
- [ ] Change the selected model, provider configuration and stable skill revision. Reopen the original output and confirm its captured origin is unchanged.
- [ ] Update the output, then inspect its historical revision. Confirm the revision retains the same provenance captured before current settings changed.
- [ ] Open the output as its personal owner and as a current project member where applicable. Remove membership and confirm project provenance becomes unavailable with the output; another personal user must receive not found.
- [ ] Delete or revoke access to an attached source. Reopen output detail and its revisions, confirm the source is labelled unavailable and no link implies that content remains accessible.
- [ ] Open an output created before migration `0027`, and a new output from a producer without complete execution facts. Confirm they say legacy and partial respectively without inventing a run or model.
- [ ] Inspect an authenticated output response, an output-list response and a public share response. Confirm detail includes bounded provenance, while lists and public shares omit it.
- [ ] Inspect stored provenance JSON. Confirm it contains identifiers, names, revision numbers and approval outcomes only—no prompts, tool arguments, source contents, tokens, credentials or costs.
- [ ] Exercise an old iPhone client against a run containing provider and approval provenance. Confirm optional fields do not prevent the run from decoding.

**Stop and report if:** current settings rewrite old origin facts, an unauthorised user receives provenance, an inaccessible source remains presented as available, or persisted provenance contains prompt, argument, content, credential or cost data.
