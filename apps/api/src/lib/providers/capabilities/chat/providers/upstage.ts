import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class UpstageProvider extends BaseProvider {
	name = "upstage";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "UPSTAGE_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(): Promise<string> {
		return "https://api.upstage.ai/v1/chat/completions";
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);

		return {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		};
	}
}
