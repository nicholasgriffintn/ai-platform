import { gatewayId } from "~/constants/app";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import { StorageService } from "~/lib/storage";
import { persistGeneratedOutput } from "~/lib/storage/generated-media";
import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";
import {
	createCommonParameters,
	getToolsForProvider,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { buildInputSchemaInput } from "~/utils/inputSchema";
import { BaseProvider } from "./base";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";

const logger = getLogger({ prefix: "lib/providers/workers" });

type WorkersMediaPayload = {
	prompt: string;
	image?: number[] | string;
	lang?: string;
};

function getModalityFlags(modelConfig?: ModelConfigItem) {
	const inputs = modelConfig?.modalities?.input ?? ["text"];
	const outputs = modelConfig?.modalities?.output ?? inputs;
	return {
		supportsTextInput: inputs.includes("text"),
		isImageToText: inputs.includes("image") && outputs.includes("text"),
		isImageToImage: inputs.includes("image") && outputs.includes("image"),
		isTextToImage: !inputs.includes("image") && outputs.includes("image"),
		isTextToSpeech:
			inputs.includes("text") && (outputs.includes("audio") || outputs.includes("speech")),
	};
}

function messageContentHasImage(content: unknown): boolean {
	if (Array.isArray(content)) {
		return content.some((item) => {
			return (
				item &&
				typeof item === "object" &&
				"image_url" in item &&
				typeof item.image_url === "object" &&
				item.image_url !== null &&
				"url" in item.image_url
			);
		});
	}

	return (
		content !== null &&
		typeof content === "object" &&
		"image" in content &&
		typeof content.image === "string" &&
		content.image.length > 0
	);
}

function requestHasImageInput(params: ChatCompletionParameters): boolean {
	return params.messages?.some((message) => messageContentHasImage(message.content)) ?? false;
}

function getContentImage(content: ChatCompletionParameters["messages"][number]["content"]) {
	if (Array.isArray(content)) {
		const imageItem = content.find((item) => item.type === "image_url" && item.image_url?.url);
		if (imageItem?.image_url?.url) {
			return imageItem.image_url.url;
		}

		const inlineImageItem = content.find((item) => typeof item.image === "string");
		if (typeof inlineImageItem?.image === "string") {
			return inlineImageItem.image;
		}

		return null;
	}

	if (isRecord(content) && typeof content.image === "string") {
		return content.image;
	}

	return null;
}

function getContentText(content: ChatCompletionParameters["messages"][number]["content"]) {
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		const textItem = content.find((item) => typeof item.text === "string");
		return typeof textItem?.text === "string" ? textItem.text : "";
	}

	return isRecord(content) && typeof content.text === "string" ? content.text : "";
}

function decodeBase64ImageData(base64Data: string) {
	const payload = base64Data.startsWith("data:") ? base64Data.split(",", 2)[1] || "" : base64Data;
	const binary = atob(payload);
	const array = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		array[i] = binary.charCodeAt(i);
	}

	if (array.length === 0) {
		throw new AssistantError("No image data found after processing", ErrorType.PARAMS_ERROR);
	}

	return Array.from(array);
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Unknown error";
}

type GeneratedOutput = ReadableStream | string | ArrayBuffer | Uint8Array;

function isGeneratedOutput(value: unknown): value is GeneratedOutput {
	return (
		typeof value === "string" ||
		value instanceof ArrayBuffer ||
		value instanceof Uint8Array ||
		value instanceof ReadableStream
	);
}

function getGeneratedOutput(
	modelResponse: unknown,
	field: "image" | "audio",
	useWholeResponse: boolean,
): GeneratedOutput | undefined {
	if (isRecord(modelResponse) && isGeneratedOutput(modelResponse[field])) {
		return modelResponse[field];
	}

	return useWholeResponse && isGeneratedOutput(modelResponse) ? modelResponse : undefined;
}

function getResponseDescription(modelResponse: unknown) {
	return isRecord(modelResponse) && typeof modelResponse.description === "string"
		? modelResponse.description
		: undefined;
}

export class WorkersProvider extends BaseProvider {
	name = "workers-ai";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return null;
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(): Promise<string> {
		return "";
	}

	protected getHeaders(): Record<string, string> {
		return {};
	}

	async mapParameters(
		params: ChatCompletionParameters,
		storageService?: StorageService,
		assetsUrl?: string,
	): Promise<Record<string, any>> {
		const modelConfig = await getModelConfigByMatchingModel(
			params.model || "",
			params.env,
			this.name,
		);
		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${params.model}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		if (params.body?.input && modelConfig.inputSchema?.fields?.length) {
			const { input } = buildInputSchemaInput(params, modelConfig);
			return typeof input === "string" ? { prompt: input } : input;
		}

		const flags = getModalityFlags(modelConfig);
		const shouldUseMediaPayload =
			flags.isTextToImage ||
			flags.isTextToSpeech ||
			flags.isImageToImage ||
			(flags.isImageToText && (!flags.supportsTextInput || requestHasImageInput(params)));

		let imageData: WorkersMediaPayload["image"];
		if (shouldUseMediaPayload) {
			if (
				params.messages.length > 2 ||
				(params.messages.length === 2 && params.messages[0].role !== "system")
			) {
				throw new AssistantError(
					"You cannot use images with more than 2 user messages, Please start a new conversation.",
					ErrorType.PARAMS_ERROR,
				);
			}

			try {
				let imageContent: string | null = null;
				for (const message of params.messages) {
					imageContent = getContentImage(message.content);
					if (imageContent) {
						break;
					}
				}

				if (imageContent) {
					const isUrl = imageContent.startsWith("http");

					if (flags.isImageToText) {
						let base64Data = null;

						if (isUrl) {
							if (!assetsUrl) {
								throw new AssistantError(
									"Assets URL is required for image URL processing",
									ErrorType.CONFIGURATION_ERROR,
								);
							}

							const isFirstPartyUrl = imageContent.startsWith(assetsUrl);

							if (!isFirstPartyUrl) {
								throw new AssistantError(
									"Image URL must be from the same domain as the assets URL",
									ErrorType.PARAMS_ERROR,
								);
							}

							if (!storageService) {
								throw new AssistantError(
									"Storage service is required for image URL processing",
									ErrorType.CONFIGURATION_ERROR,
								);
							}

							base64Data = await storageService.getPrivateAssetImageDataUrl(
								imageContent,
								params.user?.id,
								assetsUrl,
							);
						} else {
							base64Data = imageContent;
						}

						if (!base64Data) {
							throw new AssistantError("No image data found", ErrorType.PARAMS_ERROR);
						}

						try {
							imageData = decodeBase64ImageData(base64Data);
						} catch (binaryError) {
							throw new AssistantError(
								`Failed to process image data: ${getErrorMessage(binaryError)}`,
								ErrorType.PARAMS_ERROR,
							);
						}
					}
				} else {
					imageData = imageContent;
				}
			} catch (error) {
				throw new AssistantError(
					`Error processing image data: ${getErrorMessage(error)}`,
					ErrorType.PARAMS_ERROR,
				);
			}

			let prompt = "";

			if (params.messages.length >= 2 && params.messages[0].role === "system") {
				const systemContent = getContentText(params.messages[0].content);
				const userContent = getContentText(params.messages[1].content);
				prompt = `${systemContent}\n\n${userContent}`;
			} else {
				prompt = getContentText(params.messages[0].content);
			}

			if (flags.isTextToSpeech) {
				return {
					prompt: prompt || "",
					lang: params.lang ?? "en",
				};
			}

			if (!imageData && !flags.isTextToImage) {
				throw new AssistantError("No image data found in the request", ErrorType.PARAMS_ERROR);
			}

			if (!prompt) {
				const result: WorkersMediaPayload = { prompt: "" };
				if (imageData) {
					result.image = imageData;
				}
				return result;
			}

			const result: WorkersMediaPayload = { prompt };
			if (imageData) {
				result.image = imageData;
			}
			return result;
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
		const supportsToolCalls = modelConfig?.supportsToolCalls || false;

		const toolConfig = supportsToolCalls ? { toolConfig: { tools: toolsParams.tools } } : {};

		return {
			...commonParams,
			...streamingParams,
			...toolConfig,
			stop: params.stop,
			n: params.n,
			random_seed: params.seed,
			messages: params.messages,
		};
	}

	async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
		const { model, env, user: _user } = params;

		if (!model) {
			throw new AssistantError("Missing model", ErrorType.PARAMS_ERROR);
		}

		const storageService = StorageService.forPrivateAssetsEnv(env);
		const body = await this.mapParameters(params, storageService, env.API_BASE_URL);

		return trackProviderMetrics({
			provider: "workers-ai",
			model,
			operation: async () => {
				const modelResponse = await env.AI.run(model, body, {
					gateway: {
						id: gatewayId,
						skipCache: false,
						cacheTtl: 7200,
						metadata: getAiGatewayMetadataHeaders(params),
					},
				});

				const modelConfig = await getModelConfigByMatchingModel(model, env, this.name);
				const responseFlags = getModalityFlags(modelConfig);

				const responseWasStreamed = body.stream;

				const imageOutput = getGeneratedOutput(
					modelResponse,
					"image",
					responseFlags.isTextToImage || responseFlags.isImageToImage,
				);
				if (imageOutput) {
					try {
						if (!params.user?.id) {
							throw new AssistantError(
								"User ID is required to store generated image",
								ErrorType.FORBIDDEN,
								403,
							);
						}
						const storedImage = await persistGeneratedOutput({
							mediaContext: {
								env,
								model,
								completionId: params.completion_id,
								userId: params.user.id,
							},
							output: imageOutput,
							extension: "png",
							mimeType: "image/png",
							filename: "image.png",
							dataUrlMimePattern: "image\\/\\w+",
						});

						const imageResponse = {
							response: "Image Generated.",
							data: {
								attachments: [
									{
										type: "image",
										assetId: storedImage.assetId,
										url: storedImage.url,
										key: storedImage.key,
									},
								],
							},
						};

						if (responseWasStreamed) {
							return imageResponse;
						}

						return await this.formatResponse(imageResponse, params);
					} catch (error) {
						logger.error("Error generating image", { error });
						return "";
					}
				}

				const audioOutput = getGeneratedOutput(
					modelResponse,
					"audio",
					responseFlags.isTextToSpeech,
				);
				if (audioOutput) {
					try {
						if (!params.user?.id) {
							throw new AssistantError(
								"User ID is required to store generated audio",
								ErrorType.FORBIDDEN,
								403,
							);
						}
						const storedAudio = await persistGeneratedOutput({
							mediaContext: {
								env,
								model,
								completionId: params.completion_id,
								userId: params.user.id,
							},
							output: audioOutput,
							extension: "mp3",
							mimeType: "audio/mpeg",
							filename: "audio.mp3",
							dataUrlMimePattern: "audio\\/\\w+",
						});

						const audioResponse = {
							response: "Audio Generated.",
							data: {
								attachments: [
									{
										type: "audio",
										assetId: storedAudio.assetId,
										url: storedAudio.url,
										key: storedAudio.key,
									},
								],
							},
						};

						if (responseWasStreamed) {
							return audioResponse;
						}

						return await this.formatResponse(audioResponse, params);
					} catch (error) {
						logger.error("Error generating audio", { error });
						return "";
					}
				}

				const description = getResponseDescription(modelResponse);
				if (description) {
					const descriptionResponse = {
						response: description,
						data: modelResponse,
					};

					if (responseWasStreamed) {
						return descriptionResponse;
					}

					return await this.formatResponse(descriptionResponse, params);
				}

				if (responseWasStreamed) {
					return modelResponse;
				}

				return await this.formatResponse(modelResponse, params);
			},
			analyticsEngine: env.ANALYTICS,
			settings: {
				temperature: params.temperature,
				max_tokens: params.max_tokens,
				top_p: params.top_p,
				top_k: params.top_k,
				seed: params.seed,
				repetition_penalty: params.repetition_penalty,
				frequency_penalty: params.frequency_penalty,
				presence_penalty: params.presence_penalty,
			},
			userId,
			completion_id: params.completion_id,
		});
	}
}
