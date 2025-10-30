import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class HuggingFaceProvider extends BaseProvider {
  name = "huggingface";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "HUGGINGFACE_TOKEN";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  /*
		TODO: Need to support requesting later

		{
			"error": "Model HuggingFaceTB/SmolLM2-1.7B-Instruct is currently loading",
			"estimated_time": 136.9101104736328
		}
	*/

  protected async getEndpoint(
    params: ChatCompletionParameters,
  ): Promise<string> {
    return `${params.model}/v1/chat/completions`;
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);
    return this.buildAiGatewayHeaders(params, apiKey);
  }
}
