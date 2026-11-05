import { sourcePodcastGenerationTaskSchema } from "@ngriffin_uk/polychat-schemas";

import { withExecutionRunContext } from "~/infrastructure/context/serviceContext";
import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask } from "~/modules/queue/application/workflows";
import { withSourceFunding } from "~/modules/sources/application/funding";
import { runPodcastGeneration } from "~/modules/sources/application/podcasts/generate";

export const sourcePodcastGeneration = defineTask({
  durable: true,
  payload: sourcePodcastGenerationTaskSchema,
  handle: async ({ sourceId, runId }, { env, message, execution }) => {
    const owner = await loadUserContext(env, message.user_id);

    if (!owner) {
      return { status: "error", message: "A podcast requires an owner" };
    }

    const context = runId ? withExecutionRunContext(owner, runId) : owner;
    const outcome = await withSourceFunding(context, sourceId, () =>
      runPodcastGeneration(context, sourceId, execution.steps, () => execution.fence.assertOwned()),
    );

    return {
      status: outcome === "failed" ? "error" : "success",
      message: outcome === "skipped" ? "Nothing to generate" : `Podcast ${outcome}`,
    };
  },
});
