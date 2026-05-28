import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";

type MistralApiOperation = "embeddings" | "codestralEmbeddings" | "moderations" | "ocr";

const MISTRAL_OPERATION_ENDPOINTS = {
	embeddings: "v1/embeddings",
	codestralEmbeddings: "v1/embeddings",
	moderations: "v1/moderations",
	ocr: "v1/ocr",
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
		if (params.fim_mode || typeof params.suffix !== "undefined") {
			return "v1/fim/completions";
		}

		const operation = getMistralApiOperation(await this.getModelConfig(params));
		return operation ? MISTRAL_OPERATION_ENDPOINTS[operation] : "v1/chat/completions";
	}

	async mapParameters(params: ChatCompletionParameters) {
		if (params.fim_mode || typeof params.suffix !== "undefined") {
			const fimParams = {
				model: params.model,
				prompt: params.prompt,
				suffix: params.suffix,
				max_tokens: params.max_tokens,
				min_tokens: params.min_tokens,
				temperature: params.temperature,
				top_p: params.top_p,
				stop: params.stop,
				stream: params.stream,
			};

			return Object.fromEntries(
				Object.entries(fimParams).filter(([, value]) => value !== undefined && value !== null),
			);
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

		if (operation === "ocr") {
			return {
				model: modelConfig.matchingModel,
				document: params.body.document,
				id: params.body.id,
				pages: params.body.pages,
				include_image_base64: params.body.include_image_base64,
				image_limit: params.body.image_limit,
				image_min_size: params.body.image_min_size,
			};
		}

		return await this.defaultMapParameters(params);
	}

	protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);
		return this.buildAiGatewayHeaders(params, apiKey);
	}
}
