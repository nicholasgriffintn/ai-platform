import { z } from "zod/v4";

import { withExecutionRunContext } from "~/infrastructure/context/serviceContext";
import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask } from "~/modules/queue/application/workflows";
import { runPodcastGeneration } from "~/modules/sources/application/podcasts/generate";

export const sourcePodcastGeneration = defineTask({
  durable: true,
  payload: z.object({ sourceId: z.string().min(1), runId: z.string().min(1).optional() }),
  handle: async ({ sourceId, runId }, { env, message, execution }) => {
    const owner = await loadUserContext(env, message.user_id);

    if (!owner) {
      return { status: "error", message: "A podcast requires an owner" };
    }

    const context = runId ? withExecutionRunContext(owner, runId) : owner;
    const outcome = await runPodcastGeneration(context, sourceId, execution.steps);

    return {
      status: outcome === "failed" ? "error" : "success",
      message: outcome === "skipped" ? "Nothing to generate" : `Podcast ${outcome}`,
    };
  },
});
