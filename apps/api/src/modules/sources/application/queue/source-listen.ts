import { z } from "zod/v4";

import { withExecutionRunContext } from "~/infrastructure/context/serviceContext";
import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask } from "~/modules/queue/application/workflows";
import { runSourceListen } from "~/modules/sources/application/media/listen";

export const sourceListen = defineTask({
  payload: z.object({
    sourceId: z.string().min(1),
    contentHash: z.string().min(1),
    runId: z.string().min(1).optional(),
  }),
  handle: async ({ sourceId, contentHash, runId }, { env, message }) => {
    const owner = await loadUserContext(env, message.user_id);

    if (!owner) {
      return { status: "error", message: "Reading aloud requires an owner" };
    }

    const context = runId ? withExecutionRunContext(owner, runId) : owner;
    const listen = await runSourceListen(context, sourceId, contentHash);

    return {
      status: listen?.status === "failed" ? "error" : "success",
      message: listen ? `Read aloud ${listen.status}` : "Nothing to read aloud",
    };
  },
});
