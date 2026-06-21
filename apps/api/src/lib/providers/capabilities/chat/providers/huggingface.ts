import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import type { FetchAIResponseOptions } from "../../../lib/fetch";
import { createAsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import { fetchAIResponse } from "../../../lib/fetch";
import {
	createCommonParameters,
	getToolsForProvider,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { isRecord, omitUndefinedValues } from "~/utils/objects";
import {
	buildHuggingFaceExtraBody,
	getHuggingFaceFetchOptions,
	getHuggingFaceLoadingError,
	getHuggingFaceLoadingPollIntervalMs,
	type HuggingFaceLoadingError,
} from "~/lib/providers/utils/huggingFace";
import { BaseProvider } from "./base";

export class HuggingFaceProvider extends BaseProvider {
	name = "huggingface";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "HUGGINGFACE_TOKEN";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	protected async getEndpoint(_params: ChatCompletionParameters): Promise<string> {
		return "https://router.huggingface.co/v1/chat/completions";
	}

	protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);
		return this.buildAiGatewayHeaders(params, apiKey);
	}

	protected getFetchOptions(
		params: ChatCompletionParameters,
		modelConfig: ModelConfigItem,
	): FetchAIResponseOptions {
		return getHuggingFaceFetchOptions(params, modelConfig);
	}

	async mapParameters(params: ChatCompletionParameters): Promise<Record<string, any>> {
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

		return omitUndefinedValues({
			...commonParams,
			...streamingParams,
			...getToolsForProvider(params, modelConfig, this.name),
			...buildHuggingFaceExtraBody(params, modelConfig),
		});
	}

	private createLoadingResponse(
		params: ChatCompletionParameters,
		body: Record<string, any>,
		endpoint: string,
		loadingError: HuggingFaceLoadingError,
	): Record<string, any> {
		const placeholderContent = [
			{
				type: "text" as const,
				text: "Hugging Face is loading this model. We'll update this message once it is ready.",
			},
		];

		const asyncInvocationData = createAsyncInvocationMetadata({
			provider: this.name,
			id: generateId(),
			type: "huggingface.chat-completion.retry",
			pollIntervalMs: getHuggingFaceLoadingPollIntervalMs(loadingError.estimatedTimeSeconds),
			initialResponse: loadingError.body,
			context: {
				model: params.model,
				endpoint,
				body: {
					...body,
					stream: false,
				},
			},
			contentHints: {
				placeholder: placeholderContent,
				progress: placeholderContent,
				failure: [
					{
						type: "text",
						text: "Hugging Face could not load this model. Please try again later.",
					},
				],
			},
		});

		return {
			response: placeholderContent,
			status: "in_progress",
			data: {
				asyncInvocation: asyncInvocationData,
				estimated_time: loadingError.estimatedTimeSeconds,
				error: loadingError.message,
			},
		};
	}

	async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
		this.validateParams(params);

		const headers = await this.getHeaders(params);
		const modelConfig = await getModelConfigByMatchingModel(
			params.model || "",
			params.env,
			params.provider || this.name,
		);
		if (!modelConfig) {
			throw new AssistantError(`Model ${params.model} not found`, ErrorType.CONFIGURATION_ERROR);
		}

		return trackProviderMetrics({
			provider: this.name,
			model: params.model as string,
			operation: async () => {
				const body = await this.mapParameters(params);
				const endpoint = await this.getEndpoint(params);

				try {
					const data = await fetchAIResponse(
						this.isOpenAiCompatible,
						this.name,
						endpoint,
						headers,
						body,
						params.env,
						this.getFetchOptions(params, modelConfig),
					);

					if (data instanceof ReadableStream) {
						return data;
					}

					return await this.formatResponse(data, params);
				} catch (error) {
					const loadingError = getHuggingFaceLoadingError(error);
					if (loadingError && !params.stream) {
						return this.createLoadingResponse(params, body, endpoint, loadingError);
					}

					throw error;
				}
			},
			analyticsEngine: params.env?.ANALYTICS,
			settings: this.buildMetricsSettings(params),
			userId,
			completion_id: params.completion_id,
			request: params,
		});
	}

	async getAsyncInvocationStatus(
		metadata: AsyncInvocationMetadata,
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<{
		status: "in_progress" | "completed" | "failed";
		result?: any;
		raw: Record<string, any>;
	}> {
		const context = metadata.context || {};
		const body = isRecord(context.body) ? (context.body as Record<string, any>) : undefined;
		const endpoint = typeof context.endpoint === "string" ? context.endpoint : undefined;
		const model = typeof context.model === "string" ? context.model : params.model;

		if (!body || !endpoint || !model) {
			return {
				status: "failed",
				raw: {
					error: "Missing Hugging Face retry context",
				},
			};
		}

		const pollParams = {
			...params,
			model,
			provider: this.name,
			stream: false,
		} as ChatCompletionParameters;

		this.validateAiGatewayToken(pollParams);

		const apiKey = await this.getApiKey(pollParams, userId);
		const headers = this.buildAiGatewayHeaders(pollParams, apiKey);
		const modelConfig = await getModelConfigByMatchingModel(model, params.env, this.name);
		const fetchOptions = this.getFetchOptions(
			pollParams,
			modelConfig || {
				matchingModel: model,
				provider: this.name,
				modalities: { input: ["text"], output: ["text"] },
			},
		);

		try {
			const data = await fetchAIResponse<Record<string, any>>(
				this.isOpenAiCompatible,
				this.name,
				endpoint,
				headers,
				{
					...body,
					stream: false,
				},
				params.env,
				fetchOptions,
			);

			return {
				status: "completed",
				result: await this.formatResponse(data, pollParams),
				raw: data,
			};
		} catch (error) {
			const loadingError = getHuggingFaceLoadingError(error);
			if (loadingError) {
				return {
					status: "in_progress",
					raw: loadingError.body,
				};
			}

			return {
				status: "failed",
				raw: {
					error: error instanceof Error ? error.message : "Hugging Face retry failed",
				},
			};
		}
	}
}
