import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { getAiGatewayMetadataHeaders, resolveAiGatewayCacheTtl } from "../../../gateway.js";
import type { ProviderStorage } from "../../../host.js";
import { buildInputSchemaInput } from "../../../input-schema.js";
import type { ChatCompletionParameters, Message } from "../../../types/index.js";
import { BaseProvider } from "./base.js";

function flattenTranscript(messages: Message[]): string {
  return messages
    .map((message) => {
      const content =
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? message.content.map((part) => (part.type === "text" ? part.text : "")).join("")
            : "";

      return `${message.role}: ${content}`;
    })
    .join("\n");
}

export class FalAIProvider extends BaseProvider {
  name = "fal";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "FAL_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    return this.requireModel(params);
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Key ${apiKey}`,
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

    if (typeof input === "object" && !("prompt" in input)) {
      const fallbackPrompt = flattenTranscript(params.messages ?? []);

      if (fallbackPrompt) {
        input.prompt = fallbackPrompt;
      }
    }

    return input as Record<string, any>;
  }
}
