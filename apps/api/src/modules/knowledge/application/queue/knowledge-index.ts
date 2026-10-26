import { z } from "zod/v4";

import { indexResourceForUser } from "~/modules/knowledge/application/index/indexing";
import { defineTask } from "~/modules/queue/application/workflows";

export const knowledgeIndex = defineTask({
  payload: z.object({
    sourceId: z.string().min(1),
    resourceType: z.enum(["source", "output"]).default("source"),
  }),
  handle: async ({ sourceId, resourceType }, { env, message, execution }) => {
    await indexResourceForUser(env, message.user_id, resourceType, sourceId, () =>
      execution.lease.assertOwned(),
    );

    return { status: "success", message: "Knowledge processed and indexed" };
  },
});
