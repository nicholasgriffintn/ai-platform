import { generatePodcastSchema } from "@ngriffin_uk/polychat-schemas";
import type z from "zod/v4";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { ensureFolder } from "~/modules/sources/application/folders";
import { startPodcastGeneration } from "~/modules/sources/application/podcasts/generate";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  generate_podcast as generatePodcastDescriptor,
  type generatePodcastInputSchema,
} from "./definitions/generate_podcast";

export const generate_podcast: ApiToolDefinition = {
  ...generatePodcastDescriptor,
  execute: async (args: z.infer<typeof generatePodcastInputSchema>, toolContext) => {
    const context = resolveServiceContext(toolContext.request);
    const user = context.requireUser();
    const projectId = resolveRequestProjectId(toolContext.request);
    const showId = args.show
      ? (await ensureFolder(context, user.id, { projectId, title: args.show, kind: "podcast" })).id
      : undefined;
    const episode = await startPodcastGeneration(
      context,
      generatePodcastSchema.parse({
        projectId,
        sourceIds: args.source_ids ?? [],
        material: args.material,
        title: args.title,
        focus: args.focus,
        format: args.format,
        length: args.length,
        showId,
      }),
    );

    return {
      status: "success",
      name: generatePodcastDescriptor.name,
      content: `Started the episode "${episode.title}". It will appear in Sources${args.show ? ` and the ${args.show} feed` : ""} in a few minutes.`,
      data: { sourceId: episode.id, showId },
    } satisfies IFunctionResponse;
  },
};
