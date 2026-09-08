# Shared chat run lifecycle

- **Change:** stored authenticated turns now receive a stable run identity, command acknowledgement and authoritative lifecycle shared by API, web, iOS and project-task execution.
- **Surfaces:** API, web Chat, Work project tasks and native iOS.
- **Prerequisites:** apply generated D1 migration `0021_late_grandmaster.sql` before deploying consumers.
- **Risk if wrong:** duplicate submissions may execute twice, stale attempts may overwrite terminal state, or authorised clients may not observe the accepted run.
- **Commits:** none yet.

## Verify

- [x] Submit one stored Chat turn on web and confirm the stream reports one run ID from `running` through its terminal or waiting state; reopen the conversation and confirm `latest_run` has the same ID.
- [x] Repeat an identical API request with the same `command_id` and confirm the second response returns the same run with `duplicate: true` and creates no second assistant/tool work.
- [x] Reuse that `command_id` with changed input and confirm HTTP 409 without new work.
- [ ] Open the same stored conversation on iPhone and confirm its decoded latest run matches the web/API identity without affecting existing message rendering.
- [x] For a project task, confirm a current workspace member can read `/chat/runs/:run_id`, then remove membership and confirm the same status request is denied.
- [ ] Force a waiting question or approval, answer it, and confirm the same run resumes with an incremented attempt and its response message retains the run ID.
- [ ] Force conversation lease takeover before a write and confirm the stale attempt ends as `interrupted` without replacing later or terminal state.

**Stop and report if:** the same command produces another run, terminal state regresses, a non-member can read project run status, or either client treats the contract as proof that execution survives Worker failure.

## Automated browser/API evidence — 8 September 2026

- The corresponding project-access, skill-tools and teammate-feedback journeys passed in `test-results/container/d20cf00c/results.json`. A stored project conversation run is readable by a current member and returns 404 after membership is removed. The same run access service protects project-task runs; this journey creates a project conversation rather than dispatching a task.

- Container `9e1ebf31` passed the run lifecycle and tour navigation journeys: one run identity survives a tool turn and reopening, identical commands return a duplicate receipt without new messages, changed input returns 409, and all six tour links plus the direct pricing fragment reach their headings. The unrelated Poly and provider-mark journeys failed and remain open.
