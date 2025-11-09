import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	createCommonParameters,
	getToolsForProvider,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { BaseProvider } from "./base";

export class OllamaProvider extends BaseProvider {
	name = "ollama";
	supportsStreaming = false;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "OLLAMA_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);

		if (params.env.OLLAMA_ENABLED !== "true") {
			throw new AssistantError(
				"Missing OLLAMA_ENABLED",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
	}

	protected async getEndpoint(
		params: ChatCompletionParameters,
	): Promise<string> {
		const ollamaUrl = params.env.OLLAMA_URL || "http://localhost:11434";
		return `${ollamaUrl}/api/chat`;
	}

	protected getHeaders(): Record<string, string> {
		return {
			"Content-Type": "application/json",
		};
	}

	async mapParameters(
		params: ChatCompletionParameters,
		_storageService?: StorageService,
		_assetsUrl?: string,
	): Promise<Record<string, any>> {
		const modelConfig = await getModelConfigByMatchingModel(params.model || "");
		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${params.model}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const commonParams = createCommonParameters(
			params,
			modelConfig,
			this.name,
			this.isOpenAiCompatible,
		);

		const streamingParams = shouldEnableStreaming(
			modelConfig,
			this.supportsStreaming,
			params.stream,
		)
			? { stream: true }
			: {};

		const toolsParams = getToolsForProvider(params, modelConfig, this.name);

		return {
			...commonParams,
			...streamingParams,
			...toolsParams,
		};
	}
}
