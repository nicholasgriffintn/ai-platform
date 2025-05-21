import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class GithubModelsProvider extends BaseProvider {
  name = "github-models";
  supportsStreaming = true;

  protected getProviderKeyName(): string {
    return "GITHUB_MODELS_API_TOKEN";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected getEndpoint(): string {
    const githubModelsUrl = "https://models.inference.ai.azure.com";
    return `${githubModelsUrl}/chat/completions`;
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }
}
