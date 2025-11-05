import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { StorageService } from "~/lib/storage";
import {
	createAsyncInvocationMetadata,
	type AsyncInvocationMetadata,
} from "~/lib/async/asyncInvocation";
import type { ChatCompletionParameters, Message } from "~/types";
import type { ModelConfigItem, ReplicateInputFieldDescriptor } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";
import { fetchAIResponse } from "../lib/fetch";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";
import { safeParseJson } from "../../../utils/json";

type ReplicateFieldType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "file"
	| "array"
	| "object";

type ReplicateInputBuildResult = {
	input: Record<string, any> | string;
};

function normalizeFieldTypes(
	field: ReplicateInputFieldDescriptor,
): ReplicateFieldType[] {
	return Array.isArray(field.type)
		? (field.type as ReplicateFieldType[])
		: [field.type as ReplicateFieldType];
}

function extractPromptFromMessages(messages: Message[]): string {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message.role !== "user" && message.role !== "developer") {
			continue;
		}

		const { content } = message;

		if (typeof content === "string") {
			if (content.trim()) {
				return content.trim();
			}
			continue;
		}

		if (Array.isArray(content)) {
			const textParts = content
				.filter(
					(part) => part?.type === "text" && typeof part.text === "string",
				)
				.map((part) => part.text!.trim())
				.filter(Boolean);

			if (textParts.length) {
				return textParts.join("\n");
			}
		} else if (content && typeof content === "object") {
			const promptLike =
				typeof (content as any).prompt === "string"
					? (content as any).prompt
					: typeof (content as any).text === "string"
						? (content as any).text
						: undefined;

			if (promptLike && promptLike.trim()) {
				return promptLike.trim();
			}
		}
	}

	return "";
}

function extractAssetFromMessage(message?: Message): string | undefined {
	if (!message) {
		return undefined;
	}

	const { content, data } = message as any;

	if (Array.isArray(content)) {
		for (const part of content) {
			if (!part || typeof part !== "object") {
				continue;
			}

			if (part.type === "image_url" && part.image_url?.url) {
				return part.image_url.url;
			}

			if (part.type === "audio_url" && part.audio_url?.url) {
				return part.audio_url.url;
			}

			if (part.type === "video_url" && part.video_url?.url) {
				return part.video_url.url;
			}

			if (part.type === "document_url" && part.document_url?.url) {
				return part.document_url.url;
			}

			if (part.type === "input_audio" && part.input_audio?.data) {
				return part.input_audio.data;
			}
		}
	}

	if (content && typeof content === "object" && !Array.isArray(content)) {
		if (typeof (content as any).url === "string") {
			return (content as any).url;
		}

		if (typeof (content as any).file === "string") {
			return (content as any).file;
		}
	}

	const attachments = data?.attachments;
	if (Array.isArray(attachments) && attachments.length > 0) {
		const firstAttachment = attachments[0];
		if (firstAttachment?.url) {
			return firstAttachment.url;
		}

		if (firstAttachment?.markdown) {
			return firstAttachment.markdown;
		}
	}

	return undefined;
}

function coerceValue(value: unknown, types: ReplicateFieldType[]): unknown {
	if (value === undefined || value === null) {
		return value;
	}

	if (types.includes("boolean") && typeof value === "string") {
		if (value.toLowerCase() === "true") {
			return true;
		}
		if (value.toLowerCase() === "false") {
			return false;
		}
	}

	if (
		(types.includes("number") || types.includes("integer")) &&
		typeof value === "string"
	) {
		const parsed = types.includes("integer")
			? parseInt(value, 10)
			: parseFloat(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}

	if (types.includes("array") && typeof value === "string") {
		const parsed = safeParseJson(value);
		if (Array.isArray(parsed)) {
			return parsed;
		}
		return value;
	}

	if (types.includes("object") && typeof value === "string") {
		const parsed = safeParseJson(value);
		if (parsed && typeof parsed === "object") {
			return parsed;
		}
	}

	return value;
}

function pickFromSources(
	fieldName: string,
	sources: Array<Record<string, any> | undefined>,
): unknown {
	for (const source of sources) {
		if (!source) {
			continue;
		}

		if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
			const value = source[fieldName];
			if (value !== undefined) {
				return value;
			}
		}
	}

	return undefined;
}

function buildFieldValue(
	field: ReplicateInputFieldDescriptor,
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): unknown {
	const lastMessage = params.messages?.[params.messages.length - 1];
	const messageContent =
		lastMessage &&
		typeof lastMessage.content === "object" &&
		!Array.isArray(lastMessage.content)
			? (lastMessage.content as Record<string, any>)
			: undefined;

	const candidateSources = [
		params.body?.input as Record<string, any> | undefined,
		params.body as Record<string, any> | undefined,
		params.options as Record<string, any> | undefined,
		params.message && typeof params.message === "object"
			? (params.message as Record<string, any>)
			: undefined,
		messageContent,
		params as unknown as Record<string, any>,
	];

	const types = normalizeFieldTypes(field);
	let value = pickFromSources(field.name, candidateSources);

	if (value === undefined) {
		if (types.includes("string") && field.name.toLowerCase() === "prompt") {
			const prompt = extractPromptFromMessages(params.messages || []);
			if (prompt) {
				value = prompt;
			}
		} else if (types.includes("file")) {
			value = pickFromSources(field.name, [messageContent]);
			if (value === undefined) {
				value = extractAssetFromMessage(lastMessage);
			}
		}
	}

	if (value === undefined && field.default !== undefined) {
		value = field.default;
	}

	if (value === undefined && field.required) {
		throw new AssistantError(
			`Missing required input "${field.name}" for model ${modelConfig.matchingModel}`,
			ErrorType.PARAMS_ERROR,
		);
	}

	if (value === undefined) {
		return undefined;
	}

	const coerced = coerceValue(value, types);

	if (field.enum && field.enum.length > 0) {
		const enumValues = new Set(field.enum);
		if (!enumValues.has(coerced as never)) {
			throw new AssistantError(
				`Invalid value "${coerced}" for field "${field.name}". Expected one of: ${field.enum.join(", ")}.`,
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	return coerced;
}

export function buildReplicateInput(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): ReplicateInputBuildResult {
	const schema = modelConfig.replicateInputSchema;
	const lastMessage = params.messages?.[params.messages.length - 1];

	if (!schema?.fields?.length) {
		const fallbackContent = lastMessage?.content;
		if (fallbackContent !== undefined) {
			if (Array.isArray(fallbackContent)) {
				const prompt = extractPromptFromMessages(params.messages || []);
				return { input: prompt || "" };
			}
			return { input: fallbackContent as any };
		}

		return { input: "" };
	}

	const input: Record<string, any> = {};

	for (const field of schema.fields) {
		const value = buildFieldValue(field, params, modelConfig);
		if (value === undefined) {
			continue;
		}

		input[field.name] = value;
	}

	return {
		input,
	};
}

export class ReplicateProvider extends BaseProvider {
	name = "replicate";
	supportsStreaming = false;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "REPLICATE_API_TOKEN";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);

		const lastMessage = params.messages[params.messages.length - 1];
		if (!lastMessage.content) {
			throw new AssistantError(
				"Missing last message content",
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	protected async getEndpoint(): Promise<string> {
		return "v1/predictions";
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);

		return {
			"cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
			Authorization: `Token ${apiKey}`,
			"Content-Type": "application/json",
			Prefer: "wait=30",
			"cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
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

		const { input } = buildReplicateInput(params, modelConfig);

		const payload: Record<string, any> = {
			version: params.version || modelConfig.matchingModel,
			input,
		};

		return payload;
	}

	async getResponse(
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<any> {
		this.validateParams(params);

		const endpoint = await this.getEndpoint();
		const headers = await this.getHeaders(params);
		const body = await this.mapParameters(params);
		const resolvedModel =
			(body?.model as string) || params.model || params.version || "unknown";

		return trackProviderMetrics({
			provider: this.name,
			model: resolvedModel,
			operation: async () => {
				const initialResponse = await fetchAIResponse(
					this.isOpenAiCompatible,
					this.name,
					endpoint,
					headers,
					body,
					params.env,
				);

				if (initialResponse.status === "succeeded") {
					return await this.formatResponse(initialResponse, params);
				}

				if (!initialResponse.id) {
					throw new AssistantError(
						"Replicate async response did not include an id",
						ErrorType.PROVIDER_ERROR,
					);
				}

				const placeholderContent = [
					{
						type: "text" as const,
						text: "Generation in progress. We'll update this message once the results are ready.",
					},
				];

				const asyncInvocationData = createAsyncInvocationMetadata({
					provider: this.name,
					id: initialResponse.id,
					type: "replicate.prediction",
					pollIntervalMs: 5000,
					initialResponse,
					context: {
						version: params.version || params.model,
					},
					contentHints: {
						placeholder: placeholderContent,
						failure: [
							{
								type: "text",
								text: "Generation failed. Please try again.",
							},
						],
					},
				});

				return {
					response: placeholderContent,
					status: "in_progress",
					data: {
						asyncInvocation: asyncInvocationData,
						id: initialResponse.id,
						status: initialResponse.status,
					},
				};
			},
			analyticsEngine: params.env?.ANALYTICS,
			settings: {
				temperature: params.temperature,
				max_tokens: params.max_tokens,
				top_p: params.top_p,
				top_k: params.top_k,
				seed: params.seed,
				repetition_penalty: params.repetition_penalty,
				frequency_penalty: params.frequency_penalty,
			},
			userId,
			completion_id: params.completion_id,
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
		const apiKey = await this.getApiKey(params, userId);
		const pollHeaders: Record<string, string> = {
			"cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
			Authorization: `Token ${apiKey}`,
			"cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
		};

		const response = await fetch(
			`https://api.replicate.com/v1/predictions/${metadata.id}`,
			{
				headers: pollHeaders,
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new AssistantError(
				`Failed to poll Replicate prediction: ${response.status} - ${errorText}`,
				ErrorType.PROVIDER_ERROR,
				response.status,
			);
		}

		const data = (await response.json()) as Record<string, any>;
		const status = String(data.status || "").toLowerCase();

		if (status === "succeeded") {
			const formatted = await this.formatResponse(data, params);
			return {
				status: "completed",
				result: formatted,
				raw: data,
			};
		}

		if (
			status === "failed" ||
			status === "canceled" ||
			status === "cancelled"
		) {
			return {
				status: "failed",
				raw: data,
			};
		}

		return {
			status: "in_progress",
			raw: data,
		};
	}
}
