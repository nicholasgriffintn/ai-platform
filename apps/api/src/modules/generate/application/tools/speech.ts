import { extendPreservingAccessors } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { handleTextToSpeech } from "~/modules/audio/application/speech";
import type { ApiToolDefinition } from "~/types/functions";

import { create_speech as create_speechDescriptor } from "./definitions/speech";

const createSpeechArgsSchema = z.object({ prompt: z.string(), lang: z.string().optional() });

export const create_speech: ApiToolDefinition = extendPreservingAccessors<
  typeof create_speechDescriptor,
  Pick<ApiToolDefinition, "execute">
>(create_speechDescriptor, {
  execute: async (args, context) => {
    const req = context.request;
    const { prompt, lang } = createSpeechArgsSchema.parse(args);
    const response = await handleTextToSpeech({
      env: req.env,
      context: req.context,
      user: req.user,
      input: prompt,
      lang: lang?.slice(0, 2),
    });

    return Array.isArray(response) ? response[0] : response;
  },
});
