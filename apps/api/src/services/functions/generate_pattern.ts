import type z from "zod/v4";

import { generateStrudelCode } from "~/services/apps/strudel/generate";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import {
  generate_pattern as generatePatternDescriptor,
  type generatePatternInputSchema,
} from "./definitions/generate_pattern";

export const generate_pattern: ApiToolDefinition = {
  ...generatePatternDescriptor,
  execute: async (args: z.infer<typeof generatePatternInputSchema>, toolContext) => {
    const request = toolContext.request;
    const user = request.user;

    if (!user?.id) {
      throw new AssistantError(
        "Writing a pattern needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const result = await generateStrudelCode({
      ...(request.context ? { context: request.context } : {}),
      ...(request.env ? { env: request.env } : {}),
      request: {
        prompt: args.prompt,
        ...(args.style ? { style: args.style } : {}),
        ...(args.tempo ? { tempo: args.tempo } : {}),
        complexity: args.complexity ?? "simple",
      },
      user,
    });

    return {
      status: "success",
      name: generatePatternDescriptor.name,
      content: `Wrote a Strudel pattern. Play or edit it in Files, or paste it into the Strudel app.`,
      data: result as unknown as Record<string, unknown>,
    } satisfies IFunctionResponse;
  },
};
