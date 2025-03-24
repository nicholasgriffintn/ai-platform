import { mapParametersToProvider } from "../lib/chat/parameters";
import { ResponseFormatter } from "../lib/formatter";
import { getModelConfigByMatchingModel } from "../lib/models";
import { trackProviderMetrics } from "../lib/monitoring";
import type { ChatCompletionParameters } from "../types/chat";
import { AssistantError, ErrorType } from "../utils/errors";
import { fetchAIResponse } from "./fetch";

export interface AIProvider {
  name: string;
  supportsStreaming: boolean;
  getResponse(params: ChatCompletionParameters): Promise<any>;
}

export abstract class BaseProvider implements AIProvider {
  abstract name: string;
  abstract supportsStreaming: boolean;

  /**
   * Validates common parameters and provider-specific requirements
   * @throws AssistantError if validation fails
   */
  protected validateParams(params: ChatCompletionParameters): void {
    if (!params.model) {
      throw new AssistantError("Missing model", ErrorType.PARAMS_ERROR);
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
  ): Record<string, string>;

  /**
   * Formats the response from the API call
   * Default implementation uses the ResponseFormatter utility
   */
  protected formatResponse(data: any, params: ChatCompletionParameters): any {
    const modelConfig = getModelConfigByMatchingModel(params.model || "");

    return ResponseFormatter.formatResponse(data, this.name, {
      model: params.model,
      type: modelConfig?.type,
    });
  }

  /**
   * Main method to get response from the provider
   * Implements the template method pattern
   */
  async getResponse(params: ChatCompletionParameters): Promise<any> {
    this.validateParams(params);

    const endpoint = this.getEndpoint(params);
    const headers = this.getHeaders(params);

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const body = mapParametersToProvider(params, this.name);
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

        return this.formatResponse(data, params);
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
    });
  }
}
