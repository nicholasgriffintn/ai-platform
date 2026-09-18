import { shouldEnableProviderThinking } from "@ngriffin_uk/polychat-ai-models";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitUndefinedValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type { ProviderStorage } from "../../../host.js";
import {
  calculateReasoningBudget,
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "../../../parameters.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { resolvePrivateAssetUrls } from "../../../utils/privateAssets.js";
import { BaseProvider } from "./base.js";

export class KimiForCodingProvider extends BaseProvider {
  name = "kimi-for-coding";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "KIMI_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected async getEndpoint(): Promise<string> {
    const baseUrl = "https://api.kimi.com/coding/v1";

    return `${baseUrl}/messages`;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      Authorization: `Bearer ${apiKey}`,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    storageService?: ProviderStorage | null,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const providerParams = storageService
      ? await resolvePrivateAssetUrls({ params, storageService, assetsUrl })
      : params;
    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      providerParams.model || "",
      providerParams.env,
      providerParams.provider || this.name,
    );

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${providerParams.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const commonParams = createCommonParameters(providerParams, modelConfig, "anthropic");
    const streamingParams = shouldEnableStreaming(
      modelConfig,
      this.supportsStreaming,
      providerParams.stream,
    )
      ? { stream: true }
      : {};
    const toolsParams = getToolsForProvider(providerParams, modelConfig, this.name);
    const thinkingParams = shouldEnableProviderThinking(
      modelConfig,
      providerParams.reasoning_effort,
    )
      ? {
          thinking: {
            type: "enabled",
            budget_tokens: calculateReasoningBudget(providerParams, modelConfig),
          },
          top_p: undefined,
          temperature: 1,
          max_tokens: Math.max(commonParams.max_tokens, 1025),
        }
      : {};

    return omitUndefinedValues({
      ...commonParams,
      ...streamingParams,
      ...toolsParams,
      ...thinkingParams,
      system: providerParams.system_prompt,
      stop_sequences: providerParams.stop,
    });
  }
}
