import { teammateTrustCheckTaskSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { defineTask } from "~/modules/queue/application/workflows";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

import { runTeammateTrustCheck } from "../trust-check/run";

export const teammateTrustCheck = defineTask({
  payload: teammateTrustCheckTaskSchema,
  handle: async (task, { env, message }) => {
    if (!message.user_id) {
      return { status: "error", message: "user_id is required for the teammate trust check" };
    }

    const user = await createServiceContext({ env })
      .repositories.get(UserRepository)
      .getUserById(message.user_id);

    if (!user) {
      return { status: "error", message: "The trust check operator no longer exists" };
    }

    const report = await runTeammateTrustCheck(createServiceContext({ env, user }), user, task);

    return {
      status: report.failed > 0 ? "error" : "success",
      message: `${report.passed} passed, ${report.failed} acted on a smuggled instruction, ${report.errored} could not run`,
      data: report,
    };
  },
});
