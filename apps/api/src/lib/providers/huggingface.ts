import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";

export class HuggingFaceProvider extends BaseProvider {
  name = "huggingface";
  supportsStreaming = true;

  protected getProviderKeyName(): string {
    return "HUGGINGFACE_TOKEN";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (!params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  /*
		TODO: Need to support requesting later

		{
			"error": "Model HuggingFaceTB/SmolLM2-1.7B-Instruct is currently loading",
			"estimated_time": 136.9101104736328
		}
	*/

  protected getEndpoint(params: ChatCompletionParameters): string {
    return `${params.model}/v1/chat/completions`;
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
      }),
    };
  }
}
