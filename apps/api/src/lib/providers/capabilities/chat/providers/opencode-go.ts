import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class OpencodeGoProvider extends BaseProvider {
	name = "opencode-go";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "OPENCODE_GO_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(): Promise<string> {
		const baseUrl = "https://opencode.ai/zen/go/v1";
		return `${baseUrl}/chat/completions/`;
	}

	protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);

		return {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		};
	}
}
