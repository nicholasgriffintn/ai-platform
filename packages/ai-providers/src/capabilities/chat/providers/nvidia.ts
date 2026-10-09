import type { ChatCompletionParameters } from "../../../types/index.js";
import { BaseProvider } from "./base.js";

export class NvidiaProvider extends BaseProvider {
  name = "nvidia";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "NVIDIA_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected async getEndpoint(): Promise<string> {
    const baseUrl = "https://integrate.api.nvidia.com/v1";

    return `${baseUrl}/chat/completions`;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }
}
