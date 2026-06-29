import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class OpencodeProvider extends BaseProvider {
	name = "opencode";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "opencode_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(): Promise<string> {
		const baseUrl = "https://opencode.ai/zen/v1";
		return `${baseUrl}/chat/completions/`;
	}

	protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.context?.user?.id);

		return {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		};
	}
}
