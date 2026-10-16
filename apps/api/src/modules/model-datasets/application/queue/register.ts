import { SCHEDULES } from "~/config/schedules";
import { evaluateServerFlag, taskFlags } from "~/modules/experiments/application";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { scheduleTrainingQualityScoring } from "./schedule";
import { TrainingQualityHandler } from "./TrainingQualityHandler";

export function registerModelDatasetsQueue(workflows: AppWorkflows): void {
  workflows.register("training_quality_scoring", new TrainingQualityHandler());

  workflows.every(
    SCHEDULES.TRAINING_QUALITY_SCORING,
    defineSchedule({
      name: "training-quality-scoring",
      enabledWhen: (env) => evaluateServerFlag(env, taskFlags(env).training_quality_scoring),
      run: ({ env }) => scheduleTrainingQualityScoring(env),
    }),
  );
}
