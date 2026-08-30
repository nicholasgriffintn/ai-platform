import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { shouldEnableProviderThinking } from "~/lib/providers/models/reasoning";
import { resolvePrivateAssetUrls } from "~/lib/providers/utils/privateAssets";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { omitUndefinedValues } from "~/utils/objects";
import {
  calculateReasoningBudget,
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";

import { BaseProvider } from "./base";

export class ThinkingMachinesProvider extends BaseProvider {
  name = "thinkingmachines";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "TINKER_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected async getEndpoint(): Promise<string> {
    const baseUrl = "https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api/v1";

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
    storageService?: StorageService,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const providerParams = storageService
      ? await resolvePrivateAssetUrls({ params, storageService, assetsUrl })
      : params;
    const modelConfig = await getModelConfigByMatchingModel(
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
