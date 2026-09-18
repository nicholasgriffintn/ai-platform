import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { getAiGatewayMetadataHeaders, resolveAiGatewayCacheTtl } from "../../../gateway.js";
import type { ProviderStorage } from "../../../host.js";
import { buildInputSchemaInput } from "../../../input-schema.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { BaseProvider } from "./base.js";

export class IdeogramProvider extends BaseProvider {
  name = "ideogram";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "IDEOGRAM_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(): Promise<string> {
    return "v1/ideogram-v3/generate";
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "Api-Key": apiKey,
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

    const { input } = buildInputSchemaInput(params, modelConfig);

    const payload: Record<string, any> =
      typeof input === "object" && input !== null ? { ...input } : { prompt: input };

    if (payload.model === undefined) {
      payload.model = modelConfig.matchingModel;
    }

    return payload;
  }
}
