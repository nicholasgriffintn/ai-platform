import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class CerebrasProvider extends BaseProvider {
	name = "cerebras";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "CEREBRAS_API_KEY";
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
