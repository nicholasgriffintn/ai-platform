import { skillReplayTaskSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { defineTask } from "~/modules/queue/application/workflows";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

import { runSkillReplay } from "../replay";

export const skillReplay = defineTask({
  payload: skillReplayTaskSchema,
  handle: async (task, { env, message }) => {
    if (!message.user_id) {
      return { status: "error", message: "user_id is required for skill replay" };
    }

    const user = await createServiceContext({ env })
      .repositories.get(UserRepository)
      .getUserById(message.user_id);

    if (!user) {
      return { status: "error", message: "The skill's owner no longer exists" };
    }

    const report = await runSkillReplay(createServiceContext({ env, user }), user, task);

    return {
      status: report.status === "failed" ? "error" : "success",
      message:
        report.status === "failed"
          ? (report.error ?? "The replay could not finish")
          : `Replay ${report.status} across ${report.cases.length} requests`,
      data: report,
    };
  },
});
