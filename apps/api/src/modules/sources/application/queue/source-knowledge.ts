import { z } from "zod/v4";

import { defineTask } from "~/modules/queue/application/workflows";
import { indexSourceForUser } from "~/modules/sources/application/knowledge-index";

export const sourceKnowledgeIndex = defineTask({
  payload: z.object({ sourceId: z.string().min(1) }),
  handle: async ({ sourceId }, { env, message, execution }) => {
    await indexSourceForUser(env, message.user_id, sourceId, () => execution.lease.assertOwned());

    return { status: "success", message: "Source knowledge index refreshed" };
  },
});
