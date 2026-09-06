# Shared chat run lifecycle

- **Change:** stored authenticated turns now receive a stable run identity, command acknowledgement and authoritative lifecycle shared by API, web, iOS and project-task execution.
- **Surfaces:** API, web Chat, Work project tasks and native iOS.
- **Prerequisites:** apply generated D1 migration `0021_late_grandmaster.sql` before deploying consumers.
- **Risk if wrong:** duplicate submissions may execute twice, stale attempts may overwrite terminal state, or authorised clients may not observe the accepted run.
- **Commits:** none yet.

## Verify

- [ ] Submit one stored Chat turn on web and confirm the stream reports one run ID from `running` through its terminal or waiting state; reopen the conversation and confirm `latest_run` has the same ID.
- [ ] Repeat an identical API request with the same `command_id` and confirm the second response returns the same run with `duplicate: true` and creates no second assistant/tool work.
- [ ] Reuse that `command_id` with changed input and confirm HTTP 409 without new work.
- [ ] Open the same stored conversation on iPhone and confirm its decoded latest run matches the web/API identity without affecting existing message rendering.
- [ ] For a project task, confirm a current workspace member can read `/chat/runs/:run_id`, then remove membership and confirm the same status request is denied.
- [ ] Force a waiting question or approval, answer it, and confirm the same run resumes with an incremented attempt and its response message retains the run ID.
- [ ] Force conversation lease takeover before a write and confirm the stale attempt ends as `interrupted` without replacing later or terminal state.

**Stop and report if:** the same command produces another run, terminal state regresses, a non-member can read project run status, or either client treats the contract as proof that execution survives Worker failure.
