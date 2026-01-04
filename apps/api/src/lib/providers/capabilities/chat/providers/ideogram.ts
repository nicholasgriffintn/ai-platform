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

export class IdeogramProvider extends BaseProvider {
	name = "ideogram";
	supportsStreaming = false;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "IDEOGRAM_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	protected async getEndpoint(): Promise<string> {
		return "v1/ideogram-v3/generate";
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);

		return {
			"cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
			"Api-Key": apiKey,
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

		const payload: Record<string, any> =
			typeof input === "object" && input !== null
				? { ...input }
				: { prompt: input };

		if (payload.model === undefined) {
			payload.model = modelConfig.matchingModel;
		}

		return payload;
	}
}
