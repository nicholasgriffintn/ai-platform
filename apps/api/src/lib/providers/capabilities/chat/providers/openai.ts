import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { shouldSendProviderReasoningEffort } from "~/lib/providers/models/reasoning";
import { shouldSendProviderVerbosity } from "~/lib/providers/models/verbosity";
import {
	buildOpenAIResponsesBody,
	shouldUseOpenAIResponsesApi,
} from "~/lib/providers/utils/openaiResponses";
import {
	createAsyncInvocationMetadata,
	type AsyncInvocationMetadata,
} from "~/lib/async/asyncInvocation";
import { gatewayId } from "~/constants/app";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { readOptionBag } from "~/utils/options";
import { appendUrlPath } from "~/utils/urls";
import {
	createCommonParameters,
	getToolsForProvider,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { safeParseJSON } from "~/lib/providers/utils/helpers";
import { BaseProvider } from "./base";
import {
	getOpenAIImageRequestInput,
	OPENAI_IMAGE_PARAMETER_NAMES,
	type OpenAIImageParams,
} from "./openaiImage";

const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_IMAGE_COUNT = 1;
const DEFAULT_AUDIO_VOICE = "marin";
const DEFAULT_AUDIO_FORMAT = "mp3";

export class OpenAIProvider extends BaseProvider {
	name = "openai";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "OPENAI_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	private isImageGeneration(params: ChatCompletionParameters): boolean {
		return params.model.startsWith("gpt-image-");
	}

	protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
		if (this.isImageGeneration(params)) {
			const hasAttachments = params.messages.some(
				(message) =>
					Array.isArray(message.content) && message.content.some((c) => c.type === "image_url"),
			);
			return hasAttachments ? "https://api.openai.com/v1/images/edits" : "images/generations";
		}

		const modelConfig = await getModelConfigByMatchingModel(
			params.model || "",
			params.env,
			params.provider || this.name,
		);
		if (modelConfig && shouldUseOpenAIResponsesApi(params, modelConfig)) {
			return "responses";
		}

		return "chat/completions";
	}

	protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);
		const endpoint = await this.getEndpoint(params);
		const isImageEdits = endpoint.includes("images/edits");

		const headers = this.buildAiGatewayHeaders(params, apiKey);

		if (isImageEdits) {
			delete headers["Content-Type"];
		}

		return headers;
	}

	private getImageFileName(blob: Blob): string {
		const mimeTypeToExtension: Record<string, string> = {
			"image/png": "image.png",
			"image/jpeg": "image.jpg",
			"image/jpg": "image.jpg",
			"image/webp": "image.webp",
		};

		return mimeTypeToExtension[blob.type] || "image.png";
	}

	private buildImageEditFormData(params: OpenAIImageParams, imageBlob: Blob): FormData {
		const formData = new FormData();

		formData.append("model", params.model || "gpt-image-1");
		formData.append("prompt", params.prompt);
		formData.append("image", imageBlob, this.getImageFileName(imageBlob));

		for (const [name, value] of Object.entries(params)) {
			if (!OPENAI_IMAGE_PARAMETER_NAMES.has(name) || name === "prompt") {
				continue;
			}

			if (value !== undefined) {
				formData.append(name, value.toString());
			}
		}

		return formData;
	}

	private async handleImageEditRequest(
		params: ChatCompletionParameters,
		prompt: string,
		storageService: StorageService,
		imageRequestInput: Partial<OpenAIImageParams>,
	): Promise<FormData> {
		const messageWithImage = params.messages.find(
			(message) =>
				Array.isArray(message.content) && message.content.some((item) => item.type === "image_url"),
		);

		if (!messageWithImage || !Array.isArray(messageWithImage.content)) {
			throw new AssistantError("No valid image found for image editing", ErrorType.PARAMS_ERROR);
		}

		const imageItem = messageWithImage.content.find((item) => item.type === "image_url");
		if (!imageItem?.image_url?.url) {
			throw new AssistantError("No image URL found for editing", ErrorType.PARAMS_ERROR);
		}

		const imageBlob = await storageService.downloadFile(imageItem.image_url.url);

		const formDataParams: OpenAIImageParams = {
			model: params.model,
			prompt,
			size: DEFAULT_IMAGE_SIZE,
			n: DEFAULT_IMAGE_COUNT,
			...imageRequestInput,
		};

		return this.buildImageEditFormData(formDataParams, imageBlob);
	}

	private handleImageToImageRequest(
		params: ChatCompletionParameters,
		prompt: string,
	): Record<string, any> {
		if (!Array.isArray(params.messages[1].content)) {
			throw new AssistantError(
				"Image to image is not supported for text input",
				ErrorType.PARAMS_ERROR,
			);
		}

		const imageUrls = params.messages[1].content
			.filter((item) => item.type === "image_url")
			.map((item) => item.image_url?.url);

		if (imageUrls.length === 0) {
			throw new AssistantError("No image urls found", ErrorType.PARAMS_ERROR);
		}

		return {
			model: params.model,
			prompt,
			image: imageUrls,
		};
	}

	private buildAudioOutputParams(params: ChatCompletionParameters): Record<string, any> {
		const options = readOptionBag(params.options);
		const audioOptions = isRecord(options.audio) ? options.audio : {};

		return {
			modalities: ["text", "audio"],
			audio: {
				voice: audioOptions.voice || options.voice || DEFAULT_AUDIO_VOICE,
				format: audioOptions.format || options.audio_format || DEFAULT_AUDIO_FORMAT,
			},
		};
	}

	private isBackgroundResponsePending(data: any): boolean {
		return (
			data?.object === "response" &&
			data?.background === true &&
			(data?.status === "queued" || data?.status === "in_progress")
		);
	}

	protected async formatResponse(data: any, params: ChatCompletionParameters): Promise<any> {
		if (!this.isBackgroundResponsePending(data)) {
			return await super.formatResponse(data, params);
		}

		const placeholderContent = [
			{
				type: "text" as const,
				text: "Response is running in the background. We'll update this message once it completes.",
			},
		];

		const asyncInvocation = createAsyncInvocationMetadata({
			provider: this.name,
			id: data.id,
			type: "openai.response",
			pollIntervalMs: 4000,
			initialResponse: data,
			context: {
				model: params.model,
			},
			contentHints: {
				placeholder: placeholderContent,
				progress: placeholderContent,
				failure: [
					{
						type: "text",
						text: "Background response failed. Please try again.",
					},
				],
			},
		});

		return {
			...data,
			response: placeholderContent,
			status: "in_progress",
			data: {
				...data.data,
				openai_response_id: data.id,
				output: data.output,
				asyncInvocation,
			},
		};
	}

	private async fetchStoredResponse(
		responseId: string,
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<Record<string, any>> {
		const endpoint = `responses/${encodeURIComponent(responseId)}`;
		const apiKey = await this.getApiKey(params, userId);
		const headers = this.buildAiGatewayHeaders(params, apiKey);
		const response = params.env?.AI
			? await fetch(
					appendUrlPath(await params.env.AI.gateway(gatewayId).getUrl(this.name), endpoint),
					{
						method: "GET",
						headers,
					},
				)
			: await fetch(`https://api.openai.com/v1/${endpoint}`, {
					method: "GET",
					headers: {
						Authorization: headers.Authorization,
						"Content-Type": headers["Content-Type"],
					},
				});

		if (!response.ok) {
			throw new AssistantError(
				`Failed to retrieve OpenAI response ${responseId}`,
				ErrorType.PROVIDER_ERROR,
				response.status,
			);
		}

		return await safeParseJSON(response, this.name);
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
		const responseId = metadata.id;
		const raw = await this.fetchStoredResponse(responseId, params, userId);
		const status = typeof raw.status === "string" ? raw.status : "in_progress";

		if (status === "completed") {
			return {
				status: "completed",
				result: await super.formatResponse(raw, params),
				raw,
			};
		}

		if (status === "failed" || status === "cancelled" || status === "incomplete") {
			return {
				status: "failed",
				raw,
			};
		}

		return {
			status: "in_progress",
			raw,
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
		const enabledTools = params.enabled_tools || [];

		const tools = [];
		if (modelConfig?.supportsToolCalls) {
			if (modelConfig?.supportsSearchGrounding && enabledTools.includes("search_grounding")) {
				tools.push({ type: "web_search_preview" });
			}
		}
		const allTools = [...tools, ...(toolsParams.tools || [])];

		const openaiSpecificTools =
			modelConfig?.supportsToolCalls && allTools.length > 0 ? { tools: allTools } : {};

		const reasoningEffort = params.reasoning_effort;
		const thinkingParams = shouldSendProviderReasoningEffort(modelConfig, reasoningEffort)
			? {
					reasoning_effort: reasoningEffort,
				}
			: {};

		const verbositySetting = params.verbosity;
		const verbosityParams = shouldSendProviderVerbosity(modelConfig, verbositySetting)
			? { verbosity: verbositySetting }
			: {};

		let modelSpecificParams = {};

		if (params.model.includes("-search-preview")) {
			modelSpecificParams = {
				...modelSpecificParams,
				frequency_penalty: undefined,
				presence_penalty: undefined,
				temperature: undefined,
				top_p: undefined,
			};
		}

		const inputs = modelConfig?.modalities?.input ?? ["text"];
		const outputs = modelConfig?.modalities?.output ?? inputs;
		const isImageEditing = outputs.includes("image") && inputs.includes("image");
		const isTextToImage = outputs.includes("image") && !inputs.includes("image");
		const producesAudio = outputs.includes("audio");

		if (isImageEditing || isTextToImage) {
			const imageRequestInput = getOpenAIImageRequestInput(params, modelConfig);
			let prompt = "";
			if (params.messages.length > 1) {
				const content = params.messages[1].content;
				prompt = typeof content === "string" ? content : content[0]?.text || "";
			} else {
				const content = params.messages[0].content;
				prompt =
					typeof content === "string"
						? content
						: Array.isArray(content)
							? content[0]?.text || ""
							: "";
			}
			prompt = imageRequestInput.prompt || prompt;

			const hasImages = params.messages.some(
				(message) =>
					Array.isArray(message.content) &&
					message.content.some((item) => item.type === "image_url"),
			);

			const endpoint = await this.getEndpoint(params);

			if (endpoint.includes("images/edits") && hasImages) {
				if (!_storageService) {
					throw new AssistantError(
						"StorageService is required for image editing",
						ErrorType.CONFIGURATION_ERROR,
					);
				}
				return await this.handleImageEditRequest(
					params,
					prompt,
					_storageService,
					imageRequestInput,
				);
			}

			if (isImageEditing && hasImages) {
				return this.handleImageToImageRequest(params, prompt);
			}

			return {
				model: params.model,
				prompt,
				...imageRequestInput,
			};
		}

		if (shouldUseOpenAIResponsesApi(params, modelConfig)) {
			return buildOpenAIResponsesBody(
				params,
				modelConfig,
				toolsParams.tools || [],
				streamingParams,
			);
		}

		return {
			...commonParams,
			...(producesAudio ? {} : streamingParams),
			...toolsParams,
			...openaiSpecificTools,
			...thinkingParams,
			...verbosityParams,
			...(producesAudio ? this.buildAudioOutputParams(params) : {}),
			...modelSpecificParams,
			store: params.store,
			logit_bias: params.logit_bias,
			n: params.n,
			stop: params.stop,
			user: typeof params.user === "string" ? params.user : params.user?.email,
		};
	}
}
