# Every App is revalidated against the nine criteria

- **Change:** This is the tracking item for the App modernisation workstream, not a code change. Each App is checked against the same nine criteria, in the new shell rather than the old one. An App is not modernised until every box below is ticked by a person.
- **Surfaces:** All of them. This item closes only when the ones below do.
- **Prerequisites:** The shell, Files and document Output work must be live, since several criteria are checked against them.
- **Risk if wrong:** An App declared modernised while it still keeps a private result store, cannot be called by a teammate, or refuses a project member.

## The nine criteria

1. **Both scopes, one component.** Renders through the shared App route in Chat and in a project with identical behaviour, or is declared personal-only in the catalogue with a stated reason. API routes resolve scope through the shared helper and refuse project requests from non-members.
2. **Results are Files.** Every durable result is an Output and every durable input a Source, with conversation provenance when started from one. No private result store.
3. **Callable by a teammate.** At least one function tool performs the App's core operation and returns a result reference, carrying the App's plan and key requirements.
4. **Reachable without navigation.** Opens from the composer, from Poly, from Discover cards and from deep links, with the path derived from scope and App id rather than a stored href.
5. **Long work is a task.** Runs through the tasks queue and reports progress, failure and completion in Activity and Attention. No App-specific polling machinery.
6. **One shell and design.** Header, back link, empty, loading, error and not-enabled states come from shared primitives, with an accessibility pass over focus order, labels and reduced motion.
7. **Catalogue metadata is truthful.** Category, type and the when/uses/produces lines describe what the App actually does, and type drives the same gating everywhere.
8. **iOS has a decision.** Native, native results with web launch, or explicitly web-only. Results always render in the Artifacts view.
9. **Tested.** One API test proving scope authority across personal, project member and non-member, one journey from start to result in Files to attaching that result in a conversation, and the tool covered by the managed-selection tests.

## Notes

Recorded iOS decisions, from the catalogue:

- Notes: native
- Articles: results-only
- Recordings: results-only
- Image Studio: results-only
- Strudel: results-only
- Replicate: results-only
- Training: web-only, and personal scope only

## Verify

### Notes

- [x] Both scopes [ ] Files [ ] Tool [ ] Reach [ ] Task [ ] Shell [ ] Catalogue [ ] iOS [ ] Tests

### Articles

- [x] Both scopes [ ] Files [ ] Tool [ ] Reach [ ] Task [ ] Shell [ ] Catalogue [ ] iOS [ ] Tests

### Recordings

- [x] Both scopes [ ] Files [ ] Tool [ ] Reach [ ] Task [ ] Shell [ ] Catalogue [ ] iOS [ ] Tests

### Image Studio

- [x] Both scopes [ ] Files [ ] Tool [ ] Reach [ ] Task [ ] Shell [ ] Catalogue [ ] iOS [ ] Tests

### Strudel

- [x] Both scopes [ ] Files [x] Tool [ ] Reach [ ] Task [ ] Shell [ ] Catalogue [ ] iOS [ ] Tests

### Replicate

- [x] Both scopes [ ] Files [ ] Tool [ ] Reach [ ] Task [ ] Shell [ ] Catalogue [ ] iOS [ ] Tests

### Training

- [x] Personal only, with the reason shown [ ] Files [ ] Tool, or a stated reason it has none [ ] Reach [ ] Task [ ] Shell [ ] Catalogue [ ] iOS [ ] Tests

**Stop and report if:** an App keeps a private result store, a project member is refused work they are entitled to, or a non-member reaches a project result.

## Scope validation — 9 September 2026

- `app-output-scopes.spec.ts` passed in container `a2d40fc4`: real API requests create separate personal/project outputs for Notes, Articles, Recordings, Strudel, Replicate, Canvas and Drawing, assert each list includes only its scope, reject disabled project apps and reject a non-member. Canvas and Drawing detail reads also reject cross-scope IDs. The owner is an authorised workspace member.
- Reviewed the shared `AppRuntime` and app route: each scope selects the same component and carries the project ID. Previously passing `app-lifecycles.spec.ts` opens all seven personal runtimes and checks project not-enabled states. Canvas and Drawing now pass project scope through their queries, mutations and output/source storage. This combines runtime API evidence with shared-renderer inspection; it does not claim every app lifecycle or physical iOS surface is complete.

- Training’s personal-only decision is also confirmed by the existing passing project-library refusal, public-catalogue badge, account Training tabs and personal app-library journeys recorded in `2026-09-06-training-is-personal.md`; its declared reason explains account-owned credentials and deployments.

- Strudel’s callable-tool criterion is confirmed by the passing `pattern-tool.spec.ts`: `generate_pattern` performs generation, saves through the same pattern service and returns an Output ID. Its normal-plan descriptor matches the app, and project calls check the enabled app grant. The broader Files/attach and managed-selection journey remains pending under Tests.
