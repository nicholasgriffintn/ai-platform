import z from "zod/v4";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { defineTask } from "~/modules/queue/application/workflows";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

import { harvestSkillFromRun } from "../harvest";

export const skillHarvest = defineTask({
  payload: z.object({ runId: z.string().min(1), conversationId: z.string().min(1) }),
  handle: async ({ runId, conversationId }, { env, message }) => {
    if (!message.user_id) {
      return { status: "error", message: "user_id is required for skill harvest" };
    }

    const user = await createServiceContext({ env })
      .repositories.get(UserRepository)
      .getUserById(message.user_id);

    if (!user) {
      return { status: "error", message: "The run's owner no longer exists" };
    }

    const outcome = await harvestSkillFromRun(createServiceContext({ env, user }), {
      user,
      runId,
      conversationId,
      projectId: message.project_id ?? null,
    });

    return {
      status: "success",
      message:
        outcome.status === "drafted"
          ? `Drafted the ${outcome.skillName} skill`
          : `Skipped: ${outcome.reason}`,
      data: outcome,
    };
  },
});
