import { generateSpeech } from "~/services/generate/speech";

import type { ApiToolDefinition } from "../../types/functions";
import { create_speech as create_speechDescriptor } from "./definitions/speech";

export const create_speech: ApiToolDefinition = {
  ...create_speechDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;
    const app_url = context.appUrl;

    const response = await generateSpeech({
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
