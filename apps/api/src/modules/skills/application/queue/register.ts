import {
  SKILL_HARVEST_TASK_TYPE,
  SKILL_OUTCOME_REVIEW_TASK_TYPE,
  SKILL_REPLAY_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { scheduleSkillOutcomeReview } from "../review";
import { skillHarvest } from "./skill-harvest";
import { skillOutcomeReview } from "./skill-outcome-review";
import { skillReplay } from "./skill-replay";

export function registerSkillsQueue(workflows: AppWorkflows): void {
  workflows.on(SKILL_HARVEST_TASK_TYPE, skillHarvest);
  workflows.on(SKILL_OUTCOME_REVIEW_TASK_TYPE, skillOutcomeReview);
  workflows.on(SKILL_REPLAY_TASK_TYPE, skillReplay);

  workflows.every(
    SCHEDULES.SKILL_OUTCOME_REVIEW,
    defineSchedule({
      name: "skill-outcome-review",
      run: ({ env }) => scheduleSkillOutcomeReview(env),
    }),
  );
}
