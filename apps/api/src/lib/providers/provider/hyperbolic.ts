import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class HyperbolicProvider extends BaseProvider {
	name = "hyperbolic";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "HYPERBOLIC_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(): Promise<string> {
		const hyperbolicUrl = "https://api.hyperbolic.xyz";
		return `${hyperbolicUrl}/v1/chat/completions`;
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
