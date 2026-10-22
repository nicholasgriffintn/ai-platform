import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import type { SourceGenerationRejection } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { hasUserProviderApiKey } from "~/infrastructure/providers/credentials";
import { getModelConfigByModel } from "~/modules/models/application/resolve";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

import { startModelGeneration } from "../execute";
import { validateCanvasModelInputRequirements } from "./input-requirements";
import { prepareCanvasInputForModel } from "./prepare-input";
import type { CanvasGenerateParams } from "./types";

export interface StudioGenerationResult {
  sources: SourceRecord[];
  rejected: SourceGenerationRejection[];
}

export async function requireGenerationEntitlement(
  context: ServiceContext,
  providerName: string,
): Promise<void> {
  const user = context.requireUser();

  if (
    !hasProEntitlement(user) &&
    !(await hasUserProviderApiKey({ env: context.env, user, providerName }))
  ) {
    throw new AssistantError(
      `Generation requires a configured ${providerName} provider key`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}

async function startStudioModel(
  context: ServiceContext,
  params: CanvasGenerateParams,
  modelId: string,
): Promise<SourceRecord | SourceGenerationRejection> {
  const modelConfig = await getModelConfigByModel(modelId);

  if (!modelConfig) {
    return { modelId, error: `Model ${modelId} is not available for ${params.mode} generation.` };
  }

  const modelName = modelConfig.name ?? modelId;

  try {
    await requireGenerationEntitlement(context, modelConfig.provider ?? "replicate");

    if (!(modelConfig.modalities?.output ?? []).includes(params.mode)) {
      throw new AssistantError(
        `Model ${modelId} does not support ${params.mode} output.`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const inputError = validateCanvasModelInputRequirements({
      model: modelConfig,
      request: params,
    });

    if (inputError) {
      throw new AssistantError(inputError, ErrorType.PARAMS_ERROR);
    }

    return await startModelGeneration({
      context,
      projectId: params.projectId,
      modelId,
      input: prepareCanvasInputForModel({ model: modelConfig, request: params }),
      generation: { type: "studio", mode: params.mode, prompt: params.prompt },
      providerWaitSeconds: modelConfig.provider === "replicate" ? 0 : undefined,
    });
  } catch (error) {
    return { modelId, modelName, error: getErrorMessage(error, "Failed to queue generation") };
  }
}

export async function startStudioGeneration(
  context: ServiceContext,
  params: CanvasGenerateParams,
): Promise<StudioGenerationResult> {
  if (!params.modelIds.length) {
    throw new AssistantError("At least one model must be selected", ErrorType.PARAMS_ERROR);
  }

  const results = await Promise.all(
    Array.from(new Set(params.modelIds)).map((modelId) =>
      startStudioModel(context, params, modelId),
    ),
  );

  return {
    sources: results.filter((result): result is SourceRecord => "id" in result),
    rejected: results.filter((result): result is SourceGenerationRejection => "error" in result),
  };
}
