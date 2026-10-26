import z from "zod/v4";

import { runKnowledgeSync } from "~/modules/knowledge/application/syncs/run";
import { defineTask } from "~/modules/queue/application/workflows";

export const knowledgeSync = defineTask({
  payload: z.object({ syncId: z.string().min(1), generation: z.number().int().positive() }),
  handle: async ({ syncId, generation }, { env, message }) => {
    if (message.user_id === undefined) {
      return { status: "error", message: "A sync requires an owner" };
    }

    await runKnowledgeSync(env, syncId, message.user_id, generation);

    return { status: "success", message: "Knowledge sync checkpoint saved" };
  },
});
