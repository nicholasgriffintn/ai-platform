import { z } from "zod/v4";

import { indexSourceForUser } from "~/modules/sources/application/knowledge-index";

import { defineTask } from "../workflows";

export const sourceKnowledgeIndex = defineTask({
  payload: z.object({ sourceId: z.string().min(1) }),
  handle: async ({ sourceId }, { env, message }) => {
    await indexSourceForUser(env, message.user_id, sourceId);

    return { status: "success", message: "Source knowledge index refreshed" };
  },
});
