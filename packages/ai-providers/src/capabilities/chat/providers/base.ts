import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { detectStreaming } from "@ngriffin_uk/polychat-utility-server/streaming";

import type { AsyncInvocationMetadata } from "../../../async-invocation.js";
import { resolveHostProviderApiKey } from "../../../credentials.js";
import { fetchAIResponse, type FetchAIResponseOptions } from "../../../fetch.js";
import { ResponseFormatter } from "../../../formatter/index.js";
import type { ProviderStorage } from "../../../host.js";
import { trackProviderMetrics } from "../../../metrics.js";
import {
  createCommonParameters,
  createStreamingParameters,
  getToolsForProvider,
} from "../../../parameters.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import {
  validateAiGatewayToken,
  buildAiGatewayHeaders,
  buildMetricsSettings,
} from "../../../utils/helpers.js";
import { resolvePrivateAssetUrls } from "../../../utils/privateAssets.js";

const logger = getLogger({ prefix: "lib/providers/base" });

export interface AIProvider {
  name: string;
  supportsStreaming: boolean;
  getResponse(params: ChatCompletionParameters, userId?: number): Promise<any>;
  countTokens?(params: ChatCompletionParameters, userId?: number): Promise<{ inputTokens: number }>;
  getAsyncInvocationStatus?(
    metadata: AsyncInvocationMetadata,
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{
    status: "in_progress" | "completed" | "failed";
    result?: any;
    raw: Record<string, any>;
  }>;
}

export abstract class BaseProvider implements AIProvider {
  abstract name: string;
  abstract supportsStreaming: boolean;
  abstract isOpenAiCompatible: boolean;

  protected supportsStreamUsageOption = true;

  constructor(protected readonly runtime: ProviderRuntime) {}

  protected abstract getProviderKeyName(): string;

  async defaultMapParameters(
    params: ChatCompletionParameters,
    storageService?: ProviderStorage | null,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      params.model || "",
      params.env,
      params.provider || this.name,
      params.context?.user?.id,
    );

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const providerParams = storageService
      ? await resolvePrivateAssetUrls({
          params,
          storageService,
          assetsUrl,
        })
      : params;

    const commonParams = createCommonParameters(
      providerParams,
      modelConfig,
      this.name,
      this.isOpenAiCompatible,
    );

    const streamingParams = createStreamingParameters(
      modelConfig,
      this.supportsStreaming,
      providerParams.stream,
      { includeUsage: this.supportsStreamUsageOption },
    );

    const toolsParams = getToolsForProvider(providerParams, modelConfig, this.name);

    return {
      ...commonParams,
      ...streamingParams,
      ...toolsParams,
    };
  }

  mapParameters?(
    params: ChatCompletionParameters,
    storageService?: ProviderStorage | null,
    assetsUrl?: string,
  ): Promise<Record<string, any>>;

  protected async getApiKey(params: ChatCompletionParameters, userId?: number): Promise<string> {
    return resolveHostProviderApiKey(this.runtime.host, {
      env: params.env,
      providerName: this.name,
      envKeyName: this.getProviderKeyName(),
      userId,
      credentialAuthority: params.credentialAuthority,
      logger,
    });
  }

  protected validateParams(params: ChatCompletionParameters): void {
    if (!params.model && !params.version) {
      throw new AssistantError("Missing model or version", ErrorType.PARAMS_ERROR);
    }
  }

  protected requireModel(params: ChatCompletionParameters): string {
    if (!params.model) {
      throw new AssistantError("Missing model", ErrorType.PARAMS_ERROR);
    }

    return params.model;
  }

  protected validateAiGatewayToken(params: ChatCompletionParameters): void {
    validateAiGatewayToken(params);
  }

  protected buildAiGatewayHeaders(
    params: ChatCompletionParameters,
    apiKey: string,
  ): Record<string, string> {
    return buildAiGatewayHeaders(params, apiKey);
  }

  protected buildMetricsSettings(params: ChatCompletionParameters): Record<string, any> {
    return buildMetricsSettings(params);
  }

  protected getFetchOptions(
    _params: ChatCompletionParameters,
    modelConfig: ModelConfigItem,
  ): FetchAIResponseOptions {
    return {
      requestTimeout: modelConfig.timeout || 100000,
      maxAttempts: 1,
    };
  }

  protected abstract getEndpoint(params: ChatCompletionParameters): Promise<string>;

  protected abstract getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> | Record<string, string>;

  protected async formatResponse(
    data: any,
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      params.model || "",
      params.env,
      params.provider || this.name,
      params.context?.user?.id,
    );

    const providerName = this.isOpenAiCompatible ? "compat" : this.name;

    return await ResponseFormatter.formatResponse(data, providerName, {
      model: params.model,
      modalities: modelConfig?.modalities,
      storage: this.runtime.host.storage.forContext({
        env: params.env,
        user: params.context?.user,
      }),
      userId:
        userId ??
        (typeof params.context?.user?.id === "number" ? params.context?.user.id : undefined),
    });
  }

  private async getParameterMapping(
    params: ChatCompletionParameters,
    storageService?: ProviderStorage | null,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
    if (this.isOpenAiCompatible) {
      return await this.defaultMapParameters(params, storageService, assetsUrl);
    }

    if (this.mapParameters) {
      return await this.mapParameters(params, storageService, assetsUrl);
    }

    return await this.defaultMapParameters(params, storageService, assetsUrl);
  }

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    this.validateParams(params);

    const model = params.model;

    if (!model) {
      throw new AssistantError("Missing model", ErrorType.PARAMS_ERROR);
    }

    const headers = await this.getHeaders(params);

    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      model,
      params.env,
      params.provider || this.name,
      params.context?.user?.id,
    );

    if (!modelConfig) {
      throw new AssistantError(`Model ${params.model} not found`, ErrorType.CONFIGURATION_ERROR);
    }

    const storageService = this.runtime.host.storage.forEnv(params.env);
    const assetsUrl = params.env.API_BASE_URL || "";

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model,
      operation: async () => {
        const body = await this.getParameterMapping(params, storageService, assetsUrl);
        const endpoint = await this.getEndpoint(params);

        const data = await fetchAIResponse(
          this.isOpenAiCompatible,
          this.name,
          endpoint,
          headers,
          body,
          params.env,
          this.getFetchOptions(params, modelConfig),
        );

        const isStreaming = detectStreaming(body, endpoint);

        if (isStreaming) {
          return data;
        }

        return await this.formatResponse(data, params, userId);
      },
      settings: this.buildMetricsSettings(params),
      userId,
      completion_id: params.completion_id,
      request: params,
    });
  }
}
