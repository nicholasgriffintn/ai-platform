import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { z } from "zod/v4";

import { runKnowledgeEnricher } from "~/modules/knowledge/application/enrichment/run";
import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask } from "~/modules/queue/application/workflows";

export const knowledgeEnrich = defineTask({
  payload: z.object({
    sourceId: z.string().min(1),
    enricher: z.string().min(1),
  }),
  handle: async ({ sourceId, enricher }, { env, message }) => {
    const context = await loadUserContext(env, message.user_id);

    if (!context) {
      return { status: "error", message: "Reading a file needs its owner" };
    }

    try {
      await runKnowledgeEnricher(context, sourceId, enricher);
    } catch (error) {
      return { status: "success", message: `Left as failed: ${getErrorMessage(error)}` };
    }

    return { status: "success", message: "File read" };
  },
});
