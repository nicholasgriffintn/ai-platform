import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class DeepSeekProvider extends BaseProvider {
	name = "deepseek";
	supportsStreaming = true;
	isOpenAiCompatible = true;

	protected getProviderKeyName(): string {
		return "DEEPSEEK_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	protected async getEndpoint(): Promise<string> {
		return "chat/completions";
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);
		return this.buildAiGatewayHeaders(params, apiKey);
	}
}
