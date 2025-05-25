import { mapParametersToProvider } from "~/lib/chat/parameters";
import { ResponseFormatter } from "~/lib/formatter";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type { ChatCompletionParameters, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { fetchAIResponse } from "./fetch";

const logger = getLogger({ prefix: "PROVIDERS" });

export interface AIProvider {
  name: string;
  supportsStreaming: boolean;
  getResponse(params: ChatCompletionParameters, userId?: number): Promise<any>;
  createRealtimeSession(
    env: IEnv,
    user: IUser,
    type: string,
    body: Record<string, any>,
  ): Promise<any>;
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
   * @param params - The parameters of the request
   * @param userId - The user ID
   * @returns The API key
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
        if (
          !(
            error instanceof AssistantError &&
            (error.type === ErrorType.NOT_FOUND ||
              error.type === ErrorType.PARAMS_ERROR)
          )
        ) {
          logger.error(`Failed to get user API key for ${this.name}:`, {
            error,
          });
        }
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
   * @param params - The parameters of the request
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
   * @param params - The parameters of the request
   * @returns The endpoint
   */
  protected abstract getEndpoint(params: ChatCompletionParameters): string;

  /**
   * Gets the headers for the API call
   * @param params - The parameters of the request
   * @returns The headers
   */
  protected abstract getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> | Record<string, string>;

  /**
   * Formats the response from the API call
   * @param data - The data to format
   * @param params - The parameters of the request
   * @returns The formatted data
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
   * @param params - The parameters of the request
   * @param userId - The user ID
   * @returns The response
   */
  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const endpoint = this.getEndpoint(params);
    const headers = await this.getHeaders(params);

    const modelConfig = getModelConfigByMatchingModel(params.model || "");

    if (!modelConfig) {
      throw new AssistantError(
        `Model ${params.model} not found`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const timeout = modelConfig.timeout || 100000;

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const body = await mapParametersToProvider(params, this.name);
        const data = await fetchAIResponse(
          this.name,
          endpoint,
          headers,
          body,
          params.env,
          {
            requestTimeout: timeout,
          },
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

  /**
   * Creates a realtime session
   * @param env - The environment variables
   * @param user - The user
   * @returns The realtime session
   */
  async createRealtimeSession(
    env: IEnv,
    user: IUser,
    type: string,
    body: Record<string, any>,
  ): Promise<any> {
    return null;
  }
}
