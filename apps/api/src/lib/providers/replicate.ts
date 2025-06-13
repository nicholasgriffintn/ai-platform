import { API_PROD_HOST } from "~/constants/app";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";
import { fetchAIResponse } from "./fetch";

export class ReplicateProvider extends BaseProvider {
  name = "replicate";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "REPLICATE_API_TOKEN";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (!params.env.AI_GATEWAY_TOKEN || !params.env.WEBHOOK_SECRET) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN or WEBHOOK_SECRET",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (!params.completion_id) {
      throw new AssistantError("Missing completion_id", ErrorType.PARAMS_ERROR);
    }

    const lastMessage = params.messages[params.messages.length - 1];
    if (!lastMessage.content) {
      throw new AssistantError(
        "Missing last message content",
        ErrorType.PARAMS_ERROR,
      );
    }
  }

  protected getEndpoint(): string {
    return "v1/predictions";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait=30",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email,
      }),
    };
  }

  private async pollForCompletion(
    predictionId: string,
    headers: Record<string, string>,
    maxAttempts = 10,
    delayMs = 20000,
  ): Promise<any> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers,
        },
      );

      const data = (await response.json()) as {
        status: string;
        error?: string;
      };

      if (data.status === "succeeded") {
        return data;
      }

      if (data.status === "failed" || data.error) {
        throw new AssistantError(
          `Prediction failed: ${data.error || "Unknown error"}`,
          ErrorType.PROVIDER_ERROR,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempts++;
    }

    throw new AssistantError(
      "Polling timeout exceeded",
      ErrorType.PROVIDER_ERROR,
    );
  }

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const endpoint = this.getEndpoint();
    const headers = await this.getHeaders(params);

    const base_webhook_url = params.app_url || `https://${API_PROD_HOST}`;
    const webhook_url = `${base_webhook_url}/webhooks/replicate?completion_id=${params.completion_id}&token=${params.env.WEBHOOK_SECRET || ""}`;

    const lastMessage = params.messages[params.messages.length - 1];

    const body: Record<string, any> = {
      version: params.version || params.model,
      input: lastMessage.content,
    };

    if (!params.should_poll) {
      body.webhook = webhook_url;
      body.webhook_events_filter = ["output", "completed"];
    }

    return trackProviderMetrics({
      provider: this.name,
      model: params.version || (params.model as string),
      operation: async () => {
        const initialResponse = await fetchAIResponse(
          this.isOpenAiCompatible,
          this.name,
          endpoint,
          headers,
          body,
          params.env,
        );

        if (params.should_poll && initialResponse.status !== "succeeded") {
          return await this.pollForCompletion(initialResponse.id, headers);
        }

        return await this.formatResponse(initialResponse, params);
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
