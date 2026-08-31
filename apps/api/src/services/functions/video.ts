import { generateVideo } from "~/services/generate/video";

import type { ApiToolDefinition } from "../../types/functions";
import { create_video as create_videoDescriptor } from "./definitions/video";

export const create_video: ApiToolDefinition = {
  ...create_videoDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;
    const app_url = context.appUrl;

    const response = await generateVideo({
      completion_id,
      app_url,
      env: req.env,
      context: req.context,
      args,
      user: req.user,
    });

    return response;
  },
};
