import {
	getAiGatewayMetadataHeaders,
	resolveAiGatewayCacheTtl,
} from "~/utils/aiGateway";
import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";
import type { StorageService } from "~/lib/storage";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { buildInputSchemaInput } from "~/utils/inputSchema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractPromptFromMessages } from "~/utils/models";

export class FalAIProvider extends BaseProvider {
	name = "fal";
	supportsStreaming = false;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "FAL_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	protected async getEndpoint(
		params: ChatCompletionParameters,
	): Promise<string> {
		return params.model;
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);

		return {
			"cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
			Authorization: `Key ${apiKey}`,
			"Content-Type": "application/json",
			"cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
			"cf-aig-cache-ttl": resolveAiGatewayCacheTtl(params).toString(),
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

		const { input } = buildInputSchemaInput(params, modelConfig);

		if (typeof input === "object" && !("prompt" in input)) {
			const fallbackPrompt = extractPromptFromMessages(params.messages);
			if (fallbackPrompt) {
				(input as Record<string, any>).prompt = fallbackPrompt;
			}
		}

		return input as Record<string, any>;
	}
}
