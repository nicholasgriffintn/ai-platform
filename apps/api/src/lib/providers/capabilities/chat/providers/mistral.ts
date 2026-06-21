import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { ModelConfigItem } from "@assistant/schemas";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { createFimParameters, isFimCompletionRequest } from "~/utils/parameters";
import { BaseProvider } from "./base";

type MistralApiOperation = "embeddings" | "codestralEmbeddings" | "moderations";

const MISTRAL_OPERATION_ENDPOINTS = {
	embeddings: "v1/embeddings",
	codestralEmbeddings: "v1/embeddings",
	moderations: "v1/moderations",
} satisfies Record<MistralApiOperation, string>;

function getMistralApiOperation(modelConfig: ModelConfigItem): MistralApiOperation | undefined {
	const operation = modelConfig.apiOperation;
	if (!operation) {
		return undefined;
	}

	if (operation in MISTRAL_OPERATION_ENDPOINTS) {
		return operation as MistralApiOperation;
	}

	throw new AssistantError(
		`Unsupported Mistral API operation ${operation} for ${modelConfig.matchingModel}`,
		ErrorType.CONFIGURATION_ERROR,
	);
}

export class MistralProvider extends BaseProvider {
	name = "mistral";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "MISTRAL_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	private async getModelConfig(params: ChatCompletionParameters): Promise<ModelConfigItem> {
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

		return modelConfig;
	}

	protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
		if (isFimCompletionRequest(params)) {
			return "v1/fim/completions";
		}

		const operation = getMistralApiOperation(await this.getModelConfig(params));
		return operation ? MISTRAL_OPERATION_ENDPOINTS[operation] : "v1/chat/completions";
	}

	async mapParameters(params: ChatCompletionParameters) {
		if (isFimCompletionRequest(params)) {
			return createFimParameters(params);
		}

		const modelConfig = await this.getModelConfig(params);

		const operation = getMistralApiOperation(modelConfig);

		if (operation === "embeddings" || operation === "moderations") {
			return {
				model: modelConfig.matchingModel,
				input: params.body.input,
			};
		}

		if (operation === "codestralEmbeddings") {
			return {
				model: modelConfig.matchingModel,
				input: params.body.input,
				output_dimension: 1024,
				output_dtype: "binary",
			};
		}

		return await this.defaultMapParameters(params);
	}

	protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);
		return this.buildAiGatewayHeaders(params, apiKey);
	}
}
