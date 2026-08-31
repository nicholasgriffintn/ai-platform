import { generateImage } from "~/services/generate/image";

import type { ApiToolDefinition } from "../../types/functions";
import { create_image as create_imageDescriptor } from "./definitions/image";

export const create_image: ApiToolDefinition = {
  ...create_imageDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;
    const app_url = context.appUrl;

    const response = await generateImage({
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
