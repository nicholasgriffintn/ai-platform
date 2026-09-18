import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { detectStreaming } from "@ngriffin_uk/polychat-utility-server/streaming";

import { fetchAIResponse } from "../../../fetch.js";
import { getAiGatewayMetadataHeaders, resolveAiGatewayCacheTtl } from "../../../gateway.js";
import type { ProviderStorage } from "../../../host.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { parseDelimitedCredentials } from "../../../utils/helpers.js";
import { BaseProvider } from "./base.js";

export class AzureOpenAIProvider extends BaseProvider {
  name = "azure-openai";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "AZURE_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected parseAzureCredentials(apiKey: string): {
    resourceName: string;
    apiVersion: string;
    token: string;
  } {
    const [resourceName, apiVersion, token] = parseDelimitedCredentials(
      apiKey,
      "::@@::",
      3,
      "Invalid Azure credentials format",
    );

    if (!resourceName || !apiVersion || !token) {
      throw new AssistantError("Invalid Azure credentials format", ErrorType.CONFIGURATION_ERROR);
    }

    return { resourceName, apiVersion, token };
  }

  protected getAzureEndpoint(
    params: ChatCompletionParameters,
    resourceName: string,
    apiVersion: string,
  ): string {
    const deployment = params.model;

    return `${resourceName}/${deployment}/chat/completions?api-version=${apiVersion}`;
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    if (this.isOpenAiCompatible) {
      return "chat/completions";
    }

    const { resourceName, apiVersion } = await this.resolveAzureCredentials(
      params,
      params.context?.user?.id,
    );

    return this.getAzureEndpoint(params, resourceName, apiVersion);
  }

  async mapParameters(params: ChatCompletionParameters): Promise<Record<string, any>> {
    const mapped = await this.defaultMapParameters(params);

    delete mapped.model;

    return mapped;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const rawKey = await this.getApiKey(params, params.context?.user?.id);
    let token = rawKey;

    if (rawKey.includes("::@@::")) {
      try {
        token = this.parseAzureCredentials(rawKey).token;
      } catch {
        token = rawKey;
      }
    }

    return {
      "Content-Type": "application/json",
      "api-key": token,
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
      "cf-aig-cache-ttl": resolveAiGatewayCacheTtl(params).toString(),
    };
  }

  private resolveAzureCredentials = async (
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{ resourceName: string; apiVersion: string; token: string }> => {
    const rawKey = await this.getApiKey(params, userId);

    if (rawKey.includes("::@@::")) {
      return this.parseAzureCredentials(rawKey);
    }

    const resourceName = params.env.AZURE_RESOURCE_NAME;
    const apiVersion = params.env.AZURE_API_VERSION || "2023-05-15";
    const token = rawKey;

    if (!resourceName) {
      throw new AssistantError(
        "Missing AZURE_RESOURCE_NAME for Azure provider",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return { resourceName, apiVersion, token };
  };

  private async getAzureParameterMapping(
    params: ChatCompletionParameters,
    storageService?: ProviderStorage | null,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
    if (this.isOpenAiCompatible) {
      return await this.defaultMapParameters(params, storageService, assetsUrl);
    }

    if (this.mapParameters) {
      return await this.mapParameters(params);
    }

    return await this.defaultMapParameters(params, storageService, assetsUrl);
  }

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    this.validateParams(params);

    const model = params.model;

    if (!model) {
      throw new AssistantError("Missing model", ErrorType.PARAMS_ERROR);
    }

    const isOpenAiCompatible = this.isOpenAiCompatible;

    const { resourceName, apiVersion } = await this.resolveAzureCredentials(
      params,
      params.context?.user?.id,
    );

    const endpoint = isOpenAiCompatible
      ? "chat/completions"
      : this.getAzureEndpoint(params, resourceName, apiVersion);
    const headers = await this.getHeaders(params);

    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      model,
      params.env,
      params.provider || this.name,
    );

    if (!modelConfig) {
      throw new AssistantError(`Model ${params.model} not found`, ErrorType.CONFIGURATION_ERROR);
    }

    const timeout = modelConfig.timeout || 100000;

    const storageService = this.runtime.host.storage.forEnv(params.env);
    const assetsUrl = params.env.API_BASE_URL || "";

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model,
      operation: async () => {
        const body = await this.getAzureParameterMapping(params, storageService, assetsUrl);
        const data = await fetchAIResponse(
          isOpenAiCompatible,
          this.name,
          endpoint,
          headers,
          body,
          params.env,
          {
            requestTimeout: timeout,
          },
        );

        const isStreaming = detectStreaming(body, endpoint);

        if (isStreaming) {
          return data;
        }

        return await this.formatResponse(data, params);
      },
      settings: {
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        top_p: params.top_p,
        top_k: params.top_k,
        seed: params.seed,
        repetition_penalty: params.repetition_penalty,
        frequency_penalty: params.frequency_penalty,
        presence_penalty: params.presence_penalty,
      },
      userId,
      completion_id: params.completion_id,
      request: params,
    });
  }
}
