import type z from "zod/v4";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { createSourceCover } from "~/modules/sources/application/media/cover";
import { summariseSource } from "~/modules/sources/application/media/notes";
import { startSourceTranscription } from "~/modules/sources/application/media/transcribe";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  process_media as processMediaDescriptor,
  type processMediaInputSchema,
} from "./definitions/process_media";

export const process_media: ApiToolDefinition = {
  ...processMediaDescriptor,
  execute: async (args: z.infer<typeof processMediaInputSchema>, toolContext) => {
    const context = resolveServiceContext(toolContext.request);
    const user = context.requireUser();
    const source =
      args.action === "transcribe"
        ? await startSourceTranscription(context, user.id, args.source_id)
        : args.action === "notes"
          ? await summariseSource(context, args.source_id, { speakers: args.speakers })
          : await createSourceCover(context, args.source_id, {});
    const content =
      args.action === "transcribe"
        ? "Transcription started. The transcript will be the source's content when it finishes."
        : args.action === "notes"
          ? "Notes saved on the source."
          : "Cover art saved on the source.";

    return {
      status: "success",
      name: processMediaDescriptor.name,
      content,
      data: { sourceId: source.id, media: source.metadata.media },
    } satisfies IFunctionResponse;
  },
};
