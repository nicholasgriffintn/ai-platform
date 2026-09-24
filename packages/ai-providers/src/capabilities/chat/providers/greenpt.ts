import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ChatCompletionParameters } from "../../../types/index.js";
import { GREENPT_API_BASE_URL, GREENPT_API_KEY_ENV } from "../../../utils/greenpt.js";
import { BaseProvider } from "./base.js";

type GreenPtApiOperation = "embeddings";

const GREENPT_OPERATION_ENDPOINTS = {
  embeddings: "embeddings",
} satisfies Record<GreenPtApiOperation, string>;

function getGreenPtApiOperation(modelConfig: ModelConfigItem): GreenPtApiOperation | undefined {
  const operation = modelConfig.apiOperation;

  if (!operation) {
    return undefined;
  }

  if (operation === "embeddings") {
    return operation;
  }

  throw new AssistantError(
    `Unsupported GreenPT API operation ${operation} for ${modelConfig.matchingModel}`,
    ErrorType.CONFIGURATION_ERROR,
  );
}

export class GreenPtProvider extends BaseProvider {
  name = "greenpt";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return GREENPT_API_KEY_ENV;
  }

  private async getModelConfig(params: ChatCompletionParameters): Promise<ModelConfigItem> {
    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      params.model || "",
      params.env,
      params.provider || this.name,
    );

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return modelConfig;
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    const operation = getGreenPtApiOperation(await this.getModelConfig(params));
    const path = operation ? GREENPT_OPERATION_ENDPOINTS[operation] : "chat/completions";

    return `${GREENPT_API_BASE_URL}/${path}`;
  }

  async mapParameters(params: ChatCompletionParameters) {
    const modelConfig = await this.getModelConfig(params);

    if (getGreenPtApiOperation(modelConfig) === "embeddings") {
      return {
        model: modelConfig.matchingModel,
        input: params.body?.input,
        ...(params.body?.encoding_format ? { encoding_format: params.body.encoding_format } : {}),
      };
    }

    return await this.defaultMapParameters(params);
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }
}
