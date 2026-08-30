import type { ChatCompletionParameters } from "~/types";

import { BaseProvider } from "./base";

const DASHSCOPE_INTERNATIONAL_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export class AlibabaProvider extends BaseProvider {
  name = "alibaba";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "DASHSCOPE_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    const baseUrl = params.env.DASHSCOPE_BASE_URL || DASHSCOPE_INTERNATIONAL_BASE_URL;

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
