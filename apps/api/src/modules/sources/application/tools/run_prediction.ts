import { getProviderModels } from "@ngriffin_uk/polychat-ai-models";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { hasUserProviderApiKey } from "~/infrastructure/providers/credentials";
import { startSourceGeneration } from "~/modules/sources/application/generation";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  run_prediction as runPredictionDescriptor,
  type runPredictionInputSchema,
} from "./definitions/run_prediction";

const SUGGESTION_LIMIT = 8;

function suggestReplicateModelIds(available: string[], requested: string): string[] {
  const needle = requested.toLowerCase();
  const matching = available.filter((id) => id.toLowerCase().includes(needle));

  return (matching.length > 0 ? matching : available).slice(0, SUGGESTION_LIMIT);
}

export const run_prediction: ApiToolDefinition = {
  ...runPredictionDescriptor,
  execute: async (args: z.infer<typeof runPredictionInputSchema>, toolContext) => {
    const request = toolContext.request;
    const context = request.context;
    const user = request.user;

    if (!context || !user?.id) {
      throw new AssistantError(
        "Running a prediction needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    if (!(await hasUserProviderApiKey({ env: context.env, user, providerName: "replicate" }))) {
      throw new AssistantError(
        "Running a Replicate model needs your own Replicate key. Add one in your provider settings and ask again.",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    const availableModelIds = Object.keys(getProviderModels("replicate"));

    if (!availableModelIds.includes(args.model_id)) {
      throw new AssistantError(
        `No Replicate model called "${args.model_id}". Try one of: ${suggestReplicateModelIds(availableModelIds, args.model_id).join(", ")}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const projectId = args.project_id ?? resolveRequestProjectId(request);
    const {
      sources: [source],
    } = await startSourceGeneration(context, {
      type: "model",
      projectId,
      modelId: args.model_id,
      input: args.input,
    });

    return {
      status: "success",
      name: runPredictionDescriptor.name,
      content:
        source?.status === "available"
          ? `The result is in Sources as "${source.title}".`
          : "The model is running. The result will appear in Sources when it finishes.",
      data: { sourceId: source?.id ?? null, modelId: args.model_id },
    } satisfies IFunctionResponse;
  },
};
