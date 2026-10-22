import { z } from "zod/v4";

import { defineTask } from "~/modules/queue/application/workflows";
import { runSourceTranscription } from "~/modules/sources/application/media/transcribe";

import { loadUserContext } from "./user-context";

export const sourceMediaTranscription = defineTask({
  payload: z.object({ sourceId: z.string().min(1) }),
  handle: async ({ sourceId }, { env, message }) => {
    const context = await loadUserContext(env, message.user_id);

    if (!context) {
      return { status: "error", message: "A transcription requires an owner" };
    }

    const source = await runSourceTranscription(context, sourceId);

    return { status: "success", message: source ? "Source transcribed" : "Nothing to transcribe" };
  },
});
