import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderStorage } from "../../../host.js";
import { createStreamingParameters, getToolsForProvider } from "../../../parameters.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { buildPerplexityAgentBody } from "../../../utils/perplexityAgent.js";
import { resolvePrivateAssetUrls } from "../../../utils/privateAssets.js";
import { BaseProvider } from "./base.js";

const AGENT_ENDPOINT = "https://api.perplexity.ai/v1/agent";

export class PerplexityAgentProvider extends BaseProvider {
  name = "perplexity-agent";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "PERPLEXITY_API_KEY";
  }

  protected async getEndpoint(): Promise<string> {
    return AGENT_ENDPOINT;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    storageService?: ProviderStorage | null,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
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

    const providerParams = storageService
      ? await resolvePrivateAssetUrls({ params, storageService, assetsUrl })
      : params;
    const toolsParams = getToolsForProvider(providerParams, modelConfig, this.name);

    return buildPerplexityAgentBody(
      providerParams,
      modelConfig,
      toolsParams.tools || [],
      createStreamingParameters(modelConfig, this.supportsStreaming, providerParams.stream, {
        includeUsage: false,
      }),
    );
  }
}
