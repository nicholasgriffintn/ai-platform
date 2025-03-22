import type { ChatCompletionParameters } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";
import { BaseProvider } from "./base";

export class TogetherAiProvider extends BaseProvider {
	name = "together-ai";
	supportsStreaming = false;

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);

		if (!params.env.TOGETHER_AI_API_KEY) {
			throw new AssistantError(
				"Missing TOGETHER_AI_API_KEY",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
	}

	protected getEndpoint(): string {
		const togetherAiUrl = "https://api.together.xyz/v1";
		return `${togetherAiUrl}/chat/completions`;
	}

	protected getHeaders(
		params: ChatCompletionParameters,
	): Record<string, string> {
		return {
			"Content-Type": "application/json",
			Authorization: `Bearer ${params.env.TOGETHER_AI_API_KEY}`,
		};
	}
}
