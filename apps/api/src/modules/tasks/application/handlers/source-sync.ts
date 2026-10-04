import z from "zod/v4";

import { runKnowledgeSync } from "~/modules/sources/application/knowledge-sync-run";

import { defineTask } from "../workflows";

export const sourceKnowledgeSync = defineTask({
  payload: z.object({ syncId: z.string().min(1), generation: z.number().int().positive() }),
  handle: async ({ syncId, generation }, { env, message }) => {
    if (message.user_id === undefined) {
      return { status: "error", message: "A sync requires an owner" };
    }

    await runKnowledgeSync(env, syncId, message.user_id, generation);

    return { status: "success", message: "Knowledge sync checkpoint saved" };
  },
});
