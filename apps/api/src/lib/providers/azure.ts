import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import { fetchAIResponse } from "~/lib/providers/fetch";
import { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { detectStreaming } from "~/utils/streaming";
import { BaseProvider } from "./base";

// @ts-expect-error - AzureOpenAIProvider is different and CBA to work around it.
export class AzureOpenAIProvider extends BaseProvider {
  name = "azure-openai";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "AZURE_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    if (!params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected parseAzureCredentials(apiKey: string): {
    resourceName: string;
    apiVersion: string;
    token: string;
  } {
    const delimiter = "::@@::";
    const parts = apiKey.split(delimiter);
    if (parts.length !== 3) {
      throw new Error("Invalid Azure credentials format");
    }
    return {
      resourceName: parts[0],
      apiVersion: parts[1],
      token: parts[2],
    };
  }

  protected getAzureEndpoint(
    params: ChatCompletionParameters,
    resourceName: string,
    apiVersion: string,
  ): string {
    const deployment = params.model;
    return `${resourceName}/${deployment}/chat/completions?api-version=${apiVersion}`;
  }

  async mapParameters(
    params: ChatCompletionParameters,
  ): Promise<Record<string, any>> {
    const mapped = await this.defaultMapParameters(params);
    delete (mapped as any).model;
    return mapped;
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const rawKey = await this.getApiKey(params, params.user?.id);
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
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email,
        userId: params.user?.id,
        platform: params.platform,
        completionId: params.completion_id,
      }),
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
    storageService?: StorageService,
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

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const isOpenAiCompatible = this.isOpenAiCompatible;

    const { resourceName, apiVersion } = await this.resolveAzureCredentials(
      params,
      params.user?.id,
    );

    const endpoint = isOpenAiCompatible
      ? "chat/completions"
      : this.getAzureEndpoint(params, resourceName, apiVersion);
    const headers = await this.getHeaders(params);

    const modelConfig = await getModelConfigByMatchingModel(params.model || "");

    if (!modelConfig) {
      throw new AssistantError(
        `Model ${params.model} not found`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const timeout = modelConfig.timeout || 100000;

    const storageService = new StorageService(params.env.ASSETS_BUCKET);
    const assetsUrl = params.env.PUBLIC_ASSETS_URL || "";

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const body = await this.getAzureParameterMapping(
          params,
          storageService,
          assetsUrl,
        );
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
      analyticsEngine: params.env?.ANALYTICS,
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
    });
  }
}
