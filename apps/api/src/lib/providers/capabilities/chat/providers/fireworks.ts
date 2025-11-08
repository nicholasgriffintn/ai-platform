import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class FireworksProvider extends BaseProvider {
	name = "fireworks";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "FIREWORKS_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(): Promise<string> {
		const fireworksUrl = "https://api.fireworks.ai/inference/v1";
		return `${fireworksUrl}/chat/completions`;
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
