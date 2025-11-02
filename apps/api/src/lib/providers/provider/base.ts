import { ResponseFormatter } from "~/lib/formatter";
import { getModelConfigByMatchingModel } from "~/lib/models";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import { trackProviderMetrics } from "~/lib/monitoring";
import { StorageService } from "~/lib/storage";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type { ChatCompletionParameters, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
	createCommonParameters,
	getToolsForProvider,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { detectStreaming } from "~/utils/streaming";
import { fetchAIResponse } from "../lib/fetch";
import {
	validateAiGatewayToken,
	buildAiGatewayHeaders,
	buildMetricsSettings,
} from "../utils/helpers";

const logger = getLogger({ prefix: "lib/providers/base" });

export interface AIProvider {
	name: string;
	supportsStreaming: boolean;
	getResponse(params: ChatCompletionParameters, userId?: number): Promise<any>;
	createRealtimeSession(
		env: IEnv,
		user: IUser,
		type: string,
		body: Record<string, any>,
	): Promise<any>;
	countTokens?(
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<{ inputTokens: number }>;
	getAsyncInvocationStatus?(
		metadata: AsyncInvocationMetadata,
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<{
		status: "in_progress" | "completed" | "failed";
		result?: any;
		raw: Record<string, any>;
	}>;
}

export abstract class BaseProvider implements AIProvider {
	abstract name: string;
	abstract supportsStreaming: boolean;
	abstract isOpenAiCompatible?: boolean;

	/**
	 * Gets the environment variable name for the provider's API key
	 */
	protected abstract getProviderKeyName(): string;

	/**
	 * Default parameter mapping implementation for providers that don't need custom logic
	 */
	async defaultMapParameters(
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

	/**
	 * Maps parameters to provider-specific format
	 * @param params - The chat completion parameters
	 * @param storageService - Optional storage service for handling files
	 * @param assetsUrl - Optional assets URL for file processing
	 * @returns The provider-specific parameters
	 */
	mapParameters?(
		params: ChatCompletionParameters,
		storageService?: StorageService,
		assetsUrl?: string,
	): Promise<Record<string, any>>;

	/**
	 * Gets the API key for the provider, checking user settings first
	 * @param params - The parameters of the request
	 * @param userId - The user ID
	 * @returns The API key
	 */
	protected async getApiKey(
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<string> {
		if (userId && params.env.DB) {
			const userSettingsRepo = new UserSettingsRepository(params.env);
			try {
				const apiKey = await userSettingsRepo.getProviderApiKey(
					userId,
					this.name,
				);
				if (apiKey) {
					return apiKey;
				}
			} catch (error) {
				if (
					!(
						error instanceof AssistantError &&
						(error.type === ErrorType.NOT_FOUND ||
							error.type === ErrorType.PARAMS_ERROR)
					)
				) {
					logger.error(`Failed to get user API key for ${this.name}:`, {
						error,
					});
				}
			}
		}

		const envKey = params.env[this.getProviderKeyName()];
		if (!envKey) {
			throw new AssistantError(
				`Missing ${this.getProviderKeyName()}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return envKey;
	}

	/**
	 * Validates common parameters and provider-specific requirements
	 * @param params - The parameters of the request
	 * @throws AssistantError if validation fails
	 */
	protected validateParams(params: ChatCompletionParameters): void {
		if (!params.model && !params.version) {
			throw new AssistantError(
				"Missing model or version",
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	/**
	 * Validates that AI_GATEWAY_TOKEN is present
	 * Helper method for providers using Cloudflare AI Gateway
	 * @param params - The parameters of the request
	 * @throws AssistantError if AI_GATEWAY_TOKEN is missing
	 */
	protected validateAiGatewayToken(params: ChatCompletionParameters): void {
		validateAiGatewayToken(params);
	}

	/**
	 * Builds standard AI Gateway headers with authorization
	 * Helper method for providers using Cloudflare AI Gateway
	 * @param params - The parameters of the request
	 * @param apiKey - The provider API key
	 * @returns Headers object with AI Gateway configuration
	 */
	protected buildAiGatewayHeaders(
		params: ChatCompletionParameters,
		apiKey: string,
	): Record<string, string> {
		return buildAiGatewayHeaders(params, apiKey);
	}

	/**
	 * Builds metrics settings object from parameters
	 * Helper method for consistent analytics tracking
	 * @param params - The parameters of the request
	 * @returns Settings object for metrics tracking
	 */
	protected buildMetricsSettings(
		params: ChatCompletionParameters,
	): Record<string, any> {
		return buildMetricsSettings(params);
	}

	/**
	 * Gets the endpoint for the API call
	 * @param params - The parameters of the request
	 * @returns The endpoint
	 */
	protected abstract getEndpoint(
		params: ChatCompletionParameters,
	): Promise<string>;

	/**
	 * Gets the headers for the API call
	 * @param params - The parameters of the request
	 * @returns The headers
	 */
	protected abstract getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> | Record<string, string>;

	/**
	 * Formats the response from the API call
	 * @param data - The data to format
	 * @param params - The parameters of the request
	 * @returns The formatted data
	 */
	protected async formatResponse(
		data: any,
		params: ChatCompletionParameters,
	): Promise<any> {
		const modelConfig = await getModelConfigByMatchingModel(params.model || "");

		const providerName = this.isOpenAiCompatible ? "compat" : this.name;

		return await ResponseFormatter.formatResponse(data, providerName, {
			model: params.model,
			type: modelConfig?.type,
			env: params.env,
		});
	}

	/**
	 * Maps parameters using the appropriate provider strategy
	 * For OpenAI-compatible providers, uses the compat provider's mapping
	 */
	private async getParameterMapping(
		params: ChatCompletionParameters,
		storageService?: StorageService,
		assetsUrl?: string,
	): Promise<Record<string, any>> {
		if (this.isOpenAiCompatible) {
			return await this.defaultMapParameters(params, storageService, assetsUrl);
		}

		if (this.mapParameters) {
			return await this.mapParameters(params, storageService, assetsUrl);
		}

		return await this.defaultMapParameters(params, storageService, assetsUrl);
	}

	/**
	 * Main method to get response from the provider
	 * Implements the template method pattern
	 * @param params - The parameters of the request
	 * @param userId - The user ID
	 * @returns The response
	 */
	async getResponse(
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<any> {
		this.validateParams(params);

		const headers = await this.getHeaders(params);

		const modelConfig = await getModelConfigByMatchingModel(params.model || "");

		if (!modelConfig) {
			throw new AssistantError(
				`Model ${params.model} not found`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const timeout = modelConfig.timeout || 100000;

		const storageService = new StorageService(params.env.ASSETS_BUCKET);
		const assetsUrl = params.env.PUBLIC_ASSETS_URL || "";

		return trackProviderMetrics({
			provider: this.name,
			model: params.model as string,
			operation: async () => {
				const body = await this.getParameterMapping(
					params,
					storageService,
					assetsUrl,
				);
				const endpoint = await this.getEndpoint(params);
				const data = await fetchAIResponse(
					this.isOpenAiCompatible,
					this.name,
					endpoint,
					headers,
					body,
					params.env,
					{
						requestTimeout: timeout,
					},
				);

				const isStreaming = detectStreaming(body, endpoint);
				if (isStreaming) {
					return data;
				}

				return await this.formatResponse(data, params);
			},
			analyticsEngine: params.env?.ANALYTICS,
			settings: this.buildMetricsSettings(params),
			userId,
			completion_id: params.completion_id,
		});
	}

	/**
	 * Creates a realtime session
	 * @param env - The environment variables
	 * @param user - The user
	 * @returns The realtime session
	 */
	async createRealtimeSession(
		_env: IEnv,
		_user: IUser,
		_type: string,
		_body: Record<string, any>,
	): Promise<any> {
		return null;
	}
}
