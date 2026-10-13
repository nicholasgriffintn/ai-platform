import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { burnCaptionsIntoVideo } from "~/modules/audio/application/captioned-video";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  caption_video as captionVideoDescriptor,
  type captionVideoInputSchema,
} from "./definitions/caption_video";
import { resolveRequestProjectId } from "./request-context";

export const caption_video: ApiToolDefinition = {
  ...captionVideoDescriptor,
  execute: async (args: z.infer<typeof captionVideoInputSchema>, toolContext) => {
    const request = toolContext.request;
    const user = request.user;

    if (!user?.id) {
      throw new AssistantError(
        "Captioning a video needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = resolveRequestProjectId(request);
    const captioned = await burnCaptionsIntoVideo({
      context: resolveServiceContext(request),
      user,
      url: args.video_url,
      ...(projectId ? { projectId } : {}),
    });

    return {
      status: "success",
      name: captionVideoDescriptor.name,
      content: `Added ${captioned.cueCount} captions to the video.`,
      data: { videoUrl: captioned.videoUrl, sourceId: captioned.sourceId },
    } satisfies IFunctionResponse;
  },
};
