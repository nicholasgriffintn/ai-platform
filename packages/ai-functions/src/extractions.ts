import {
  extractionAnswersMatchFields,
  type ProviderRuntime,
} from "@ngriffin_uk/polychat-ai-providers";
import {
  modelHasInputModalities,
  modelHasOutputModality,
  type ExtractionAnswers,
  type ExtractionFields,
  type ExtractionOptions,
  type ExtractionResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { AiRequestScope } from "./types.js";

export interface ExtractionScope extends AiRequestScope {
  model?: string;
  provider?: string;
  conversationId?: string;
  images?: string[];
}

export interface ExtractFieldsRequest<TFields extends ExtractionFields> extends ExtractionScope {
  state?: string;
  fields: TFields;
  reference_date?: string;
  options?: ExtractionOptions;
}

export interface ExtractFieldsResult<TFields extends ExtractionFields> extends Omit<
  ExtractionResponse,
  "answers"
> {
  answers: ExtractionAnswers<TFields>;
}

export interface ExtractionTarget {
  model: string;
  provider: string;
}

export function createExtractionFunctions(runtime: ProviderRuntime) {
  const resolveExtractionTarget = async (
    scope: ExtractionScope,
  ): Promise<ExtractionTarget | null> => {
    if (scope.provider) {
      return { provider: scope.provider, model: scope.model ?? "" };
    }

    if (scope.model) {
      const config = await runtime.host.models.findModelConfig(
        scope.model,
        scope.env,
        undefined,
        scope.user?.id,
      );

      if (!config || !modelHasOutputModality(config, "extraction")) {
        throw new AssistantError("Select a valid extraction model", ErrorType.PARAMS_ERROR, 400);
      }

      if (scope.images?.length && !modelHasInputModalities(config, ["image"])) {
        throw new AssistantError(
          `${config.name ?? scope.model} cannot read images`,
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      return { model: config.matchingModel, provider: config.provider };
    }

    return runtime.host.models.getSystemModel(scope.env, scope.user, "extraction");
  };

  const run = async <TFields extends ExtractionFields>(
    request: ExtractFieldsRequest<TFields>,
    target: ExtractionTarget,
  ): Promise<ExtractFieldsResult<TFields>> => {
    const provider = runtime.providers.resolve("extraction", target.provider, {
      env: request.env,
      user: request.user,
    });
    const response = await provider.extract({
      state: request.state,
      fields: request.fields,
      images: request.images,
      reference_date: request.reference_date,
      options: request.options,
      model: target.model || undefined,
      completion_id: request.completion_id,
      conversationId: request.conversationId,
    });
    const answers = response.answers;

    if (!extractionAnswersMatchFields(request.fields, answers)) {
      throw new AssistantError(
        "The extraction provider returned answers that do not match the requested fields",
        ErrorType.PROVIDER_ERROR,
      );
    }

    return { ...response, answers };
  };

  return {
    resolveExtractionTarget,
    extractFields: async <TFields extends ExtractionFields>(
      request: ExtractFieldsRequest<TFields>,
    ): Promise<ExtractFieldsResult<TFields>> => {
      const target = await resolveExtractionTarget(request);

      if (!target) {
        throw new AssistantError(
          "No extraction model is available for this account",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      return run(request, target);
    },
    tryExtractFields: async <TFields extends ExtractionFields>(
      request: ExtractFieldsRequest<TFields>,
    ): Promise<ExtractFieldsResult<TFields> | null> => {
      const target = await resolveExtractionTarget(request);

      return target ? run(request, target) : null;
    },
  };
}

export type ExtractionFunctions = ReturnType<typeof createExtractionFunctions>;
