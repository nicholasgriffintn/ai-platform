import { generateMusic } from "~/services/generate/music";

import type { ApiToolDefinition } from "../../types/functions";
import { create_music as create_musicDescriptor } from "./definitions/music";

export const create_music: ApiToolDefinition = {
  ...create_musicDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;
    const app_url = context.appUrl;

    const response = await generateMusic({
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
