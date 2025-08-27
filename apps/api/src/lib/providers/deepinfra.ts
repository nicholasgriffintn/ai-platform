import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class DeepInfraProvider extends BaseProvider {
  name = "deepinfra";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "DEEPINFRA_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected async getEndpoint(): Promise<string> {
    return "https://api.deepinfra.com/v1/openai/chat/completions";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email,
        userId: params.user?.id,
        platform: params.platform,
      }),
    };
  }
}
