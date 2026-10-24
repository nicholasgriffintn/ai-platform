import { z } from "zod/v4";

import { withExecutionRunContext } from "~/infrastructure/context/serviceContext";
import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask } from "~/modules/queue/application/workflows";
import { runPodcastGeneration } from "~/modules/sources/application/podcasts/generate";

export const sourcePodcastGeneration = defineTask({
  payload: z.object({ sourceId: z.string().min(1), runId: z.string().min(1).optional() }),
  handle: async ({ sourceId, runId }, { env, message }) => {
    const owner = await loadUserContext(env, message.user_id);

    if (!owner) {
      return { status: "error", message: "A podcast requires an owner" };
    }

    const context = runId ? withExecutionRunContext(owner, runId) : owner;
    const source = await runPodcastGeneration(context, sourceId);

    return {
      status: source?.status === "failed" ? "error" : "success",
      message: source ? `Podcast ${source.status}` : "Nothing to generate",
    };
  },
});
