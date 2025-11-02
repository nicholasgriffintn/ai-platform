import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class TogetherAiProvider extends BaseProvider {
	name = "together-ai";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "TOGETHER_AI_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(): Promise<string> {
		const togetherAiUrl = "https://api.together.xyz/v1";
		return `${togetherAiUrl}/chat/completions`;
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
