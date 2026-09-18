import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitUndefinedValues } from "@ngriffin_uk/polychat-utility-server/objects";

import { getAiGatewayMetadataHeaders, resolveAiGatewayCacheTtl } from "../../../gateway.js";
import type { ProviderStorage } from "../../../host.js";
import { getToolsForProvider } from "../../../parameters.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import {
  buildGoogleStudioGenerationConfig,
  buildGoogleStudioSystemInstruction,
  buildGoogleStudioToolConfig,
  buildGoogleStudioTools,
  formatGoogleStudioContents,
  GOOGLE_STUDIO_SAFETY_SETTINGS,
} from "../../../utils/googleStudio.js";
import { BaseProvider } from "./base.js";

export class GoogleStudioProvider extends BaseProvider {
  name = "google-ai-studio";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "GOOGLE_STUDIO_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    if (params.stream) {
      return `v1beta/models/${params.model}:streamGenerateContent?alt=sse`;
    }

    return `v1beta/models/${params.model}:generateContent`;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
      "cf-aig-cache-ttl": resolveAiGatewayCacheTtl(params).toString(),
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    _storageService?: ProviderStorage | null,
    _assetsUrl?: string,
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

    const toolsParams = getToolsForProvider(params, modelConfig, this.name);
    const providerParams = {
      ...params,
      tools: toolsParams.tools ?? params.tools,
    };

    return omitUndefinedValues({
      model: params.model,
      contents: formatGoogleStudioContents(providerParams),
      tools: buildGoogleStudioTools(providerParams, modelConfig),
      toolConfig: buildGoogleStudioToolConfig(providerParams, modelConfig),
      systemInstruction: buildGoogleStudioSystemInstruction(providerParams.system_prompt),
      safetySettings: GOOGLE_STUDIO_SAFETY_SETTINGS,
      generationConfig: buildGoogleStudioGenerationConfig(providerParams, modelConfig),
    });
  }
}
