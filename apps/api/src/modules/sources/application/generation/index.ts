import type {
  GenerateSourceMediaInput,
  Source,
  SourceGenerationRejection,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getModelConfigByModel } from "~/modules/models/application/resolve";
import { formatSource } from "~/modules/sources/application/sources";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { startModelGeneration } from "./execute";
import { requireGenerationEntitlement, startStudioGeneration } from "./studio/generate";

export interface StartedSourceGenerations {
  sources: Source[];
  rejected: SourceGenerationRejection[];
}

/**
 * Starts image, video and model generations whose results land in Sources. Each started
 * generation is a source that stays `processing` until its media arrives.
 */
export async function startSourceGeneration(
  context: ServiceContext,
  input: GenerateSourceMediaInput,
): Promise<StartedSourceGenerations> {
  if (input.projectId) {
    await requireProjectAccess(context, input.projectId);
  }

  if (input.type === "studio") {
    const { type: _type, ...params } = input;
    const started = await startStudioGeneration(context, {
      ...params,
      projectId: params.projectId ?? undefined,
    });

    if (started.sources.length === 0 && started.rejected[0]) {
      throw new AssistantError(started.rejected[0].error, ErrorType.PARAMS_ERROR, 400);
    }

    return { sources: started.sources.map(formatSource), rejected: started.rejected };
  }

  const modelConfig = await getModelConfigByModel(input.modelId);

  await requireGenerationEntitlement(context, modelConfig?.provider ?? "replicate");

  const source = await startModelGeneration({
    context,
    projectId: input.projectId,
    modelId: input.modelId,
    input: input.input,
    generation: {
      type: "model",
      prompt: typeof input.input.prompt === "string" ? input.input.prompt : undefined,
    },
  });

  return { sources: [formatSource(source)], rejected: [] };
}
