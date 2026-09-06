import type z from "zod/v4";

import { getProviderModels } from "~/lib/providers/models/catalogue";
import { hasUserProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { executeReplicateModel } from "~/services/apps/replicate/execute";
import { requireOptionalProjectCapabilityAccess } from "~/services/workspaces/access";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import {
  run_prediction as runPredictionDescriptor,
  type runPredictionInputSchema,
} from "./definitions/run_prediction";
import { resolveRequestProjectId } from "./request-context";

const REPLICATE_CAPABILITY_ID = "featured-replicate";
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

    const projectId = args.project_id ?? resolveRequestProjectId(request) ?? undefined;

    await requireOptionalProjectCapabilityAccess(
      context,
      projectId,
      "app",
      REPLICATE_CAPABILITY_ID,
    );

    const result = await executeReplicateModel({
      context,
      params: { modelId: args.model_id, input: args.input },
      user,
      storage: projectId ? { projectId } : {},
    });
    const outputId = typeof result.data.id === "string" ? result.data.id : null;

    return {
      status: "success",
      name: runPredictionDescriptor.name,
      content: `${result.content}. The result is in Files${outputId ? `, as ${outputId}` : ""}.`,
      data: { outputId, modelId: args.model_id },
    } satisfies IFunctionResponse;
  },
};
