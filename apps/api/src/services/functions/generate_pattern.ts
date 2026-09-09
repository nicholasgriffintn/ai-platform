import type z from "zod/v4";

import { generateStrudelCode } from "~/services/apps/strudel/generate";
import { savePattern } from "~/services/apps/strudel/save";
import { requireOptionalProjectCapabilityAccess } from "~/services/workspaces/access";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import {
  generate_pattern as generatePatternDescriptor,
  type generatePatternInputSchema,
} from "./definitions/generate_pattern";
import { resolveRequestProjectId } from "./request-context";

export const generate_pattern: ApiToolDefinition = {
  ...generatePatternDescriptor,
  execute: async (args: z.infer<typeof generatePatternInputSchema>, toolContext) => {
    const request = toolContext.request;
    const user = request.user;
    const context = request.context;

    if (!context || !user?.id) {
      throw new AssistantError(
        "Writing a pattern needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = resolveRequestProjectId(request) ?? undefined;

    await requireOptionalProjectCapabilityAccess(context, projectId, "app", "featured-strudel");
    const result = await generateStrudelCode({
      conversationId: toolContext.completionId,
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
    const pattern = await savePattern({
      context,
      user,
      projectId,
      conversationId: toolContext.completionId,
      request: {
        code: result.code,
        name: args.prompt.slice(0, 120),
        description: result.explanation,
      },
    });

    return {
      status: "success",
      name: generatePatternDescriptor.name,
      content: `Wrote a Strudel pattern. Play or edit it in Files, or paste it into the Strudel app.`,
      data: { ...result, outputId: pattern.id },
    } satisfies IFunctionResponse;
  },
};
