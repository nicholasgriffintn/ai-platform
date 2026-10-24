import { z } from "zod/v4";

import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask } from "~/modules/queue/application/workflows";
import { runPodcastGeneration } from "~/modules/sources/application/podcasts/generate";

export const sourcePodcastGeneration = defineTask({
  payload: z.object({ sourceId: z.string().min(1) }),
  handle: async ({ sourceId }, { env, message }) => {
    const context = await loadUserContext(env, message.user_id);

    if (!context) {
      return { status: "error", message: "A podcast requires an owner" };
    }

    const source = await runPodcastGeneration(context, sourceId);

    return {
      status: source?.status === "failed" ? "error" : "success",
      message: source ? `Podcast ${source.status}` : "Nothing to generate",
    };
  },
});
