import type { ChatCompletionParameters } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";
import { BaseProvider } from "./base";

export class GithubModelsProvider extends BaseProvider {
	name = "github-models";
	supportsStreaming = true;

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);

		if (!params.env.GITHUB_MODELS_API_TOKEN) {
			throw new AssistantError(
				"Missing GITHUB_MODELS_API_TOKEN",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
	}

	protected getEndpoint(): string {
		const githubModelsUrl = "https://models.inference.ai.azure.com";
		return `${githubModelsUrl}/chat/completions`;
	}

	protected getHeaders(
		params: ChatCompletionParameters,
	): Record<string, string> {
		return {
			"Content-Type": "application/json",
			Authorization: `Bearer ${params.env.GITHUB_MODELS_API_TOKEN}`,
		};
	}
}
