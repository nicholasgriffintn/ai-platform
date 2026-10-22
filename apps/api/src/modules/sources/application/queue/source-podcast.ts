import { z } from "zod/v4";

import { defineTask } from "~/modules/queue/application/workflows";
import { runPodcastGeneration } from "~/modules/sources/application/podcasts/generate";

import { loadUserContext } from "./user-context";

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
