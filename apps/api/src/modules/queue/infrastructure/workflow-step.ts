import { isTaskError } from "@ngriffin_uk/polychat-library-tasks";
import type { WorkflowStep, WorkflowStepConfig } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { TaskStep } from "~/modules/queue/application/types";

const RETRY_DELAY = "10 seconds";
const STEP_TIMEOUT = "1 day";

function stepConfig(retries: number): WorkflowStepConfig {
  return {
    retries: { limit: retries, delay: RETRY_DELAY, backoff: "exponential" },
    timeout: STEP_TIMEOUT,
  };
}

export function workflowTaskStep(step: WorkflowStep): TaskStep {
  return {
    do: (name, { retries }, run) =>
      step.do(name, stepConfig(retries), async (context) => {
        try {
          return await run(context.attempt);
        } catch (error) {
          if (isTaskError(error, "final_failure")) {
            throw new NonRetryableError(error.message);
          }

          throw error;
        }
      }),
    text: (name, { retries }, run) => step.do(name, stepConfig(retries), () => run()),
    sleep: (name, seconds) => step.sleep(name, `${seconds} seconds`),
  };
}
