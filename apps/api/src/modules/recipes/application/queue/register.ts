import { SCHEDULES } from "~/config/schedules";
import { d1WritesAllowed } from "~/modules/infra/application/write-breaker";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import { scheduleDueRecipeExecutions } from "~/modules/recipes/application/scheduler";

import { RecipeExecutionHandler } from "./RecipeExecutionHandler";

export function registerRecipesQueue(workflows: AppWorkflows): void {
  workflows.register("recipe_execution", new RecipeExecutionHandler());

  workflows.every(
    SCHEDULES.RECIPE_EXECUTION,
    defineSchedule({
      name: "recipe-scheduling",
      enabledWhen: d1WritesAllowed,
      run: async ({ env }) => {
        await scheduleDueRecipeExecutions(env);
      },
    }),
  );
}
