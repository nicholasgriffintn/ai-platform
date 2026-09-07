# Task board empty queue sits inside its card and new pipelines can start from a suggestion

- **Change:** The Work queue's empty and no-match states no longer draw their own bordered card inside the queue card. The agent pipeline editor offers a "Use suggested pipeline" button, only while the project has no pipeline, that fills in research, plan, build and review stages for the user to adjust and save.
- **Surfaces:** Web.
- **Prerequisites:** None.
- **Risk if wrong:** The empty queue shows doubled borders, or owners of projects that already have a pipeline see the suggestion and overwrite their stages with the defaults.
- **Commits:** Pending.

## Verify

- [x] Open a project's Tasks page in Work with no tasks. The empty queue message sits flush inside the Work queue card with a single outer border and no inner box.
- [x] Add a task and filter it out from the queue. The "No work matches" state also sits flush inside the card.
- [x] On a project with no pipeline, click Build pipeline. The top box of the editor shows Use suggested pipeline. Clicking it fills four stages: Research (explore, hands off), Plan (plan, stops for review), Build (build, hands off) and Review (explore, stops for review), all on the project default agent. Save pipeline persists them and the board shows the four stages.
- [x] Reopen Configure on that project. The suggested pipeline button is no longer shown.

**Stop and report if:** the suggested pipeline fails to save, appears on a project that already has stages, or the empty queue still shows a nested border.

## Automated evidence — 7 September 2026

- `features/project-tasks.spec.ts` creates a fresh project, opens its Tasks page and confirms the empty queue container computes a zero border width, so it draws no box of its own inside the queue card.
- It opens Build pipeline, uses the suggestion, and confirms the four stages come back as Research/Plan/Build/Review with explore, plan, build and explore modes and automatic, human, automatic and human hand-offs, all on the project default teammate.
- Saving persists them: reopening Configure shows the same four stages and no longer offers the suggestion.
- Adding a backlog task and filtering the queue to Completed shows the No work matches state, which also computes a zero border width.
