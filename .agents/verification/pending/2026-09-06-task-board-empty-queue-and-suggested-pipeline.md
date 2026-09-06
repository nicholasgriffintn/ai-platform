# Task board empty queue sits inside its card and new pipelines can start from a suggestion

- **Change:** The Work queue's empty and no-match states no longer draw their own bordered card inside the queue card. The agent pipeline editor offers a "Use suggested pipeline" button, only while the project has no pipeline, that fills in research, plan, build and review stages for the user to adjust and save.
- **Surfaces:** Web.
- **Prerequisites:** None.
- **Risk if wrong:** The empty queue shows doubled borders, or owners of projects that already have a pipeline see the suggestion and overwrite their stages with the defaults.
- **Commits:** Pending.

## Verify

- [ ] Open a project's Tasks page in Work with no tasks. The empty queue message sits flush inside the Work queue card with a single outer border and no inner box.
- [ ] Add a task and filter it out from the queue. The "No work matches" state also sits flush inside the card.
- [ ] On a project with no pipeline, click Build pipeline. The top box of the editor shows Use suggested pipeline. Clicking it fills four stages: Research (explore, hands off), Plan (plan, stops for review), Build (build, hands off) and Review (explore, stops for review), all on the project default agent. Save pipeline persists them and the board shows the four stages.
- [ ] Reopen Configure on that project. The suggested pipeline button is no longer shown.

**Stop and report if:** the suggested pipeline fails to save, appears on a project that already has stages, or the empty queue still shows a nested border.
