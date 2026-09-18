import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { appendUrlPath } from "@ngriffin_uk/polychat-utility-server/urls";

import {
  createAsyncInvocationMetadata,
  type AsyncInvocationMetadata,
} from "../../../async-invocation.js";
import type { ProviderEnv } from "../../../env.js";
import { fetchAIResponse } from "../../../fetch.js";
import { resolveAiGatewayId, getAiGatewayMetadataHeaders } from "../../../gateway.js";
import type { ProviderStorage } from "../../../host.js";
import { buildInputSchemaInput } from "../../../input-schema.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { formatProviderError } from "../../../utils/errors.js";
import { BaseProvider } from "./base.js";

export class ReplicateProvider extends BaseProvider {
  name = "replicate";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "REPLICATE_API_TOKEN";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);

    const hasContent = Boolean(params.messages?.at(-1)?.content);
    const hasBodyInput = Boolean(params.body?.input);

    if (!hasContent && !hasBodyInput) {
      throw new AssistantError("Missing last message content", ErrorType.PARAMS_ERROR);
    }
  }

  private async resolvePredictionUrl(predictionId: string, env: ProviderEnv): Promise<string> {
    const endpoint = `v1/predictions/${encodeURIComponent(predictionId)}`;

    if (!env?.AI) {
      return `https://api.replicate.com/${endpoint}`;
    }

    return appendUrlPath(await env.AI.gateway(resolveAiGatewayId(env)).getUrl(this.name), endpoint);
  }

  protected async getEndpoint(): Promise<string> {
    return "v1/predictions";
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);
    const waitSecondsOption = params.replicate_wait_seconds;
    const waitSeconds =
      typeof waitSecondsOption === "number" && Number.isFinite(waitSecondsOption)
        ? Math.max(0, Math.min(60, Math.floor(waitSecondsOption)))
        : 30;

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: `wait=${waitSeconds}`,
      "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
      "cf-aig-cache-ttl": "0",
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
      this.name,
    );

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const { input } = buildInputSchemaInput(params, modelConfig);

    const payload: Record<string, any> = {
      version: params.version || modelConfig.matchingModel,
      input,
    };

    return payload;
  }

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    this.validateParams(params);

    const endpoint = await this.getEndpoint();
    const headers = await this.getHeaders(params);
    const body = await this.mapParameters(params);
    const resolvedModel = (body?.model as string) || params.model || params.version || "unknown";

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model: resolvedModel,
      operation: async () => {
        const initialResponse = await fetchAIResponse(
          this.isOpenAiCompatible,
          this.name,
          endpoint,
          headers,
          body,
          params.env,
        );

        if (initialResponse.status === "succeeded") {
          return await this.formatResponse(initialResponse, params);
        }

        if (!initialResponse.id) {
          throw new AssistantError(
            "Replicate async response did not include an id",
            ErrorType.PROVIDER_ERROR,
          );
        }

        const placeholderContent = [
          {
            type: "text" as const,
            text: "Generation in progress. We'll update this message once the results are ready.",
          },
        ];

        const asyncInvocationData = createAsyncInvocationMetadata({
          provider: this.name,
          id: initialResponse.id,
          type: "replicate.prediction",
          pollIntervalMs: 5000,
          initialResponse,
          context: {
            version: params.version || params.model,
          },
          contentHints: {
            placeholder: placeholderContent,
            failure: [
              {
                type: "text",
                text: "Generation failed. Please try again.",
              },
            ],
          },
        });

        return {
          response: placeholderContent,
          status: "in_progress",
          data: {
            asyncInvocation: asyncInvocationData,
            id: initialResponse.id,
            status: initialResponse.status,
          },
        };
      },
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
      request: params,
    });
  }

  async getAsyncInvocationStatus(
    metadata: AsyncInvocationMetadata,
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{
    status: "in_progress" | "completed" | "failed";
    result?: any;
    raw: Record<string, any>;
  }> {
    const apiKey = await this.getApiKey(params, userId);
    const pollHeaders: Record<string, string> = {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Token ${apiKey}`,
      "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
      "cf-aig-cache-ttl": "0",
    };

    const response = await fetch(await this.resolvePredictionUrl(metadata.id, params.env), {
      headers: pollHeaders,
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "Failed to poll Replicate prediction"),
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    const data = (await response.json()) as Record<string, any>;
    const status = String(data.status || "").toLowerCase();

    if (status === "succeeded") {
      const formatted = await this.formatResponse(data, params, userId);

      return {
        status: "completed",
        result: formatted,
        raw: data,
      };
    }

    if (status === "failed" || status === "canceled" || status === "cancelled") {
      return {
        status: "failed",
        raw: data,
      };
    }

    return {
      status: "in_progress",
      raw: data,
    };
  }
}
