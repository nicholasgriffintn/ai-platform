import { mapParametersToProvider } from "~/lib/chat/parameters";
import { ResponseFormatter } from "~/lib/formatter";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { fetchAIResponse } from "./fetch";

const logger = getLogger({ prefix: "PROVIDERS" });

export interface AIProvider {
  name: string;
  supportsStreaming: boolean;
  getResponse(params: ChatCompletionParameters, userId?: number): Promise<any>;
}

export abstract class BaseProvider implements AIProvider {
  abstract name: string;
  abstract supportsStreaming: boolean;

  /**
   * Gets the environment variable name for the provider's API key
   */
  protected abstract getProviderKeyName(): string;

  /**
   * Gets the API key for the provider, checking user settings first
   */
  protected async getApiKey(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<string> {
    if (userId && params.env.DB) {
      const userSettingsRepo = new UserSettingsRepository(params.env);
      try {
        const apiKey = await userSettingsRepo.getProviderApiKey(
          userId,
          this.name,
        );
        if (apiKey) {
          return apiKey;
        }
      } catch (error) {
        logger.warn(`Failed to get user API key for ${this.name}:`, { error });
      }
    }

    const envKey = params.env[this.getProviderKeyName()];
    if (!envKey) {
      throw new AssistantError(
        `Missing ${this.getProviderKeyName()}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return envKey;
  }

  /**
   * Validates common parameters and provider-specific requirements
   * @throws AssistantError if validation fails
   */
  protected validateParams(params: ChatCompletionParameters): void {
    if (!params.model && !params.version) {
      throw new AssistantError(
        "Missing model or version",
        ErrorType.PARAMS_ERROR,
      );
    }
  }

  /**
   * Gets the endpoint for the API call
   */
  protected abstract getEndpoint(params: ChatCompletionParameters): string;

  /**
   * Gets the headers for the API call
   */
  protected abstract getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> | Record<string, string>;

  /**
   * Formats the response from the API call
   */
  protected async formatResponse(
    data: any,
    params: ChatCompletionParameters,
  ): Promise<any> {
    const modelConfig = getModelConfigByMatchingModel(params.model || "");

    return await ResponseFormatter.formatResponse(data, this.name, {
      model: params.model,
      type: modelConfig?.type,
      env: params.env,
    });
  }

  /**
   * Main method to get response from the provider
   * Implements the template method pattern
   */
  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const endpoint = this.getEndpoint(params);
    const headers = await this.getHeaders(params);

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const body =
          params.body || (await mapParametersToProvider(params, this.name));
        const data = await fetchAIResponse(
          this.name,
          endpoint,
          headers,
          body,
          params.env,
        );

        if (body.stream) {
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
      },
      userId,
      completion_id: params.completion_id,
    });
  }
}
