import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { StorageService } from "~/lib/storage";
import {
	buildGoogleStudioGenerationConfig,
	buildGoogleStudioSystemInstruction,
	buildGoogleStudioTools,
	formatGoogleStudioContents,
	GOOGLE_STUDIO_SAFETY_SETTINGS,
} from "~/lib/providers/utils/googleStudio";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";
import { getAiGatewayMetadataHeaders, resolveAiGatewayCacheTtl } from "~/utils/aiGateway";
import { omitUndefinedValues } from "~/utils/objects";
import { getToolsForProvider } from "~/utils/parameters";

export class GoogleStudioProvider extends BaseProvider {
	name = "google-ai-studio";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "GOOGLE_STUDIO_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
		if (params.stream) {
			return `v1beta/models/${params.model}:streamGenerateContent?alt=sse`;
		}
		return `v1beta/models/${params.model}:generateContent`;
	}

	protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);

		return {
			"cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
			"x-goog-api-key": apiKey,
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
		const modelConfig = await getModelConfigByMatchingModel(
			params.model || "",
			params.env,
			params.provider || this.name,
		);
		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${params.model}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const functionToolParams = {
			...params,
			enabled_tools: (params.enabled_tools || []).filter(
				(tool) => !(tool === "web_search" && modelConfig.supportsSearchGrounding),
			),
		};
		const toolsParams = getToolsForProvider(functionToolParams, modelConfig, this.name);
		const providerParams = {
			...params,
			tools: toolsParams.tools ?? params.tools,
		};

		return omitUndefinedValues({
			model: params.model,
			contents: formatGoogleStudioContents(providerParams),
			tools: buildGoogleStudioTools(providerParams, modelConfig),
			systemInstruction: buildGoogleStudioSystemInstruction(providerParams.system_prompt),
			safetySettings: GOOGLE_STUDIO_SAFETY_SETTINGS,
			generationConfig: buildGoogleStudioGenerationConfig(providerParams, modelConfig),
		});
	}
}
