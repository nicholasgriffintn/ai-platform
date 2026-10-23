import z from "zod/v4";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { defineTask } from "~/modules/queue/application/workflows";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

import { reviewUserSkills } from "../review";

export const skillOutcomeReview = defineTask({
  payload: z.object({}),
  handle: async (_payload, { env, message }) => {
    if (!message.user_id) {
      return { status: "error", message: "user_id is required for a skill review" };
    }

    const user = await createServiceContext({ env })
      .repositories.get(UserRepository)
      .getUserById(message.user_id);

    if (!user) {
      return { status: "error", message: "The skill owner no longer exists" };
    }

    const proposed = await reviewUserSkills(createServiceContext({ env, user }), user.id);

    return { status: "success", message: `Proposed ${proposed} skill reviews`, data: { proposed } };
  },
});
