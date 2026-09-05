# Durable project-task activity timeline

- **Change:** Web and iPhone reconstruct and present one task timeline covering proposed outcomes, runs, recorded steps, tool lifecycle, interactions and results without exposing raw tool payloads.
- **Surfaces:** project-task API, Work task detail on web and project-task conversations on native iOS.
- **Prerequisites:** deploy the schema and API before the updated web and iOS clients. Apply the G04–G07 run migrations first; this activity projection adds no migration.
- **Risk if wrong:** reopened tasks may lose meaningful history, activity may appear under the wrong task or run, or sensitive tool arguments and results may be exposed as progress.
- **Commits:** none yet.

## Verify

- [ ] Run a project task with at least two acceptance criteria, two tools and a written result. Open its web detail and iPhone conversation. Confirm both show proposed outcomes separately from actual run, step, tool and result activity.
- [ ] Expand web timeline entries. Confirm only safe summaries, outcome labels and tool names appear—no raw tool input, provider response JSON or assistant reasoning. Confirm the full result remains available through the result and conversation surfaces.
- [ ] Trigger a question or tool approval. Confirm its waiting entry stays visible above a long transcript on iPhone and near the top of the newest-first web timeline. Resolve it on the other device and confirm both replace it with resolved state.
- [ ] Force one tool failure, one run interruption and one cancellation. Confirm each has distinct text and icon treatment and none appears as successful completion.
- [ ] Reopen a completed task, then switch between two project-task conversations. Confirm each timeline returns after reload and contains only its project/task runs, messages and outputs.
- [ ] Reopen a legacy task or simulate a trimmed run event journal. Confirm the current run state appears as a reconstructed run snapshot rather than an empty timeline.
- [ ] Inject an unknown event type using the supported protocol version. Confirm web and iPhone show generic non-actionable activity and keep the remaining timeline usable.
- [ ] Revoke workspace membership while the task is open. Confirm neither client continues showing refreshed task activity after the authorised detail read fails.
- [ ] Test narrow and wide web layouts plus iPhone portrait and landscape with Dynamic Type, VoiceOver, keyboard navigation and dark appearance. Confirm activity ordering, expand controls, status labels and actionable entries are reachable without relying on colour.

**Presentation contract handoff:** protocol version 1 items are newest first and carry project, task, optional run and source identities; an open `type`; coarse `category` and `status`; safe title/detail/items; time; and actionable/terminal flags. Later context, retry, attention, flow evidence, usage and responsiveness work may add event types within this envelope. Do not add raw provider data or a separate progress store.

**Stop and report if:** activity crosses project/task scope, a proposed plan looks executed, waiting/failure/interruption collapse into one state, terminal or actionable entries disappear behind generated text, or any raw tool payload or reasoning appears.
