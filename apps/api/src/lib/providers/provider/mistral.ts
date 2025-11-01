import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class MistralProvider extends BaseProvider {
  name = "mistral";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "MISTRAL_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(
    params: ChatCompletionParameters,
  ): Promise<string> {
    if (
      params.model === "mistral-embed" ||
      params.model === "codestral-embed"
    ) {
      return "v1/embeddings";
    }

    if (params.model === "mistral-ocr-latest") {
      return "v1/ocr";
    }

    if (params.fim_mode || typeof params.suffix !== "undefined") {
      return "v1/fim/completions";
    }

    return "v1/chat/completions";
  }

  async mapParameters(params: ChatCompletionParameters) {
    if (params.model === "mistral-embed") {
      return {
        model: params.model,
        input: params.body.input,
      };
    }

    if (params.model === "codestral-embed") {
      return {
        model: params.model,
        input: params.body.input,
        output_dimension: 1536,
        output_dtype: "binary",
      };
    }

    if (params.fim_mode || typeof params.suffix !== "undefined") {
      const fimParams = {
        model: params.model,
        prompt: params.prompt,
        suffix: params.suffix,
        max_tokens: params.max_tokens,
        min_tokens: params.min_tokens,
        temperature: params.temperature,
        top_p: params.top_p,
        stop: params.stop,
        stream: params.stream,
      };

      return Object.fromEntries(
        Object.entries(fimParams).filter(
          ([, value]) => value !== undefined && value !== null,
        ),
      );
    }

    return await this.defaultMapParameters(params);
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);
    return this.buildAiGatewayHeaders(params, apiKey);
  }
}
