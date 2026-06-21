import { preprocessQwQResponse } from "~/lib/chat/utils/qwq";
import type { ModelModalities } from "@assistant/schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	hasPrivateAssetStorage,
	persistBase64GeneratedImages,
	persistGeneratedAsset,
	persistInlineGeneratedAsset,
	persistRemoteGeneratedAssets,
	type GeneratedMediaContext,
} from "~/lib/storage/generated-media";
import type { IEnv } from "~/types";
import { base64ToBuffer } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ResponseFormatOptions {
	model?: string;
	modalities?: ModelModalities;
	env?: IEnv;
	context?: ServiceContext;
	completion_id?: string;
	is_streaming?: boolean;
	userId?: number;
}

export class ResponseFormatter {
	private static getModalityState(modalities?: ModelModalities) {
		const inputs = modalities?.input ?? ["text"];
		const outputs = modalities?.output ?? inputs;
		const inputSet = new Set(inputs);
		const outputSet = new Set(outputs);
		return {
			inputSet,
			outputSet,
			producesImages: outputSet.has("image"),
			producesVideo: outputSet.has("video"),
			producesAudio: outputSet.has("audio"),
			producesText: outputSet.has("text"),
		};
	}

	/**
	 * Formats responses from any provider
	 * Handles specific response formats for each provider
	 * @param data - The data to format
	 * @param provider - The provider of the data
	 * @param options - The options for formatting
	 * @returns The formatted data
	 */
	static async formatResponse(
		data: any,
		provider: string,
		options: ResponseFormatOptions = {},
	): Promise<any> {
		const formatter = ResponseFormatter.getFormatter(provider);
		return await formatter(data, options);
	}

	/**
	 * Get the appropriate formatter function for a provider
	 * @param provider - The provider of the data
	 * @returns The formatter function
	 */
	private static getFormatter(
		provider: string,
	): (data: any, options: ResponseFormatOptions) => any {
		const formatters: Record<string, (data: any, options: ResponseFormatOptions) => any> = {
			openai: ResponseFormatter.formatOpenAIResponse,
			anthropic: ResponseFormatter.formatAnthropicResponse,
			"google-ai-studio": ResponseFormatter.formatGoogleStudioResponse,
			ollama: ResponseFormatter.formatOllamaResponse,
			bedrock: ResponseFormatter.formatBedrockResponse,
			workers: ResponseFormatter.formatWorkersResponse,
			"workers-ai": ResponseFormatter.formatWorkersResponse,
			openrouter: ResponseFormatter.formatOpenRouterResponse,
			groq: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			mistral: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			"perplexity-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			deepseek: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			huggingface: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			"github-models": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			"together-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			replicate: ResponseFormatter.formatReplicateResponse,
			fal: ResponseFormatter.formatReplicateResponse,
			ideogram: ResponseFormatter.formatReplicateResponse,
		};

		return formatters[provider] || ResponseFormatter.formatGenericResponse;
	}

	private static collectStringsFromOutput(output: unknown): string[] {
		if (typeof output === "string") {
			return [output];
		}

		if (Array.isArray(output)) {
			return output.flatMap((item) => ResponseFormatter.collectStringsFromOutput(item));
		}

		if (output && typeof output === "object") {
			return Object.values(output).flatMap((value) =>
				ResponseFormatter.collectStringsFromOutput(value),
			);
		}

		return [];
	}

	private static filterUrlsByExtension(urls: string[], extensions: string[]): string[] {
		return urls.filter((url) => {
			const normalized = url.split("?")[0].toLowerCase();
			return extensions.some((extension) => normalized.endsWith(extension));
		});
	}

	private static getGeneratedMediaContext(options: ResponseFormatOptions): GeneratedMediaContext {
		return {
			context: options.context,
			env: options.env,
			model: options.model,
			modalities: options.modalities,
			completionId: options.completion_id,
			userId: options.userId,
		};
	}

	private static getGoogleInlineData(
		part: Record<string, any>,
	): { data: string; mimeType?: string } | undefined {
		const inlineData = part.inlineData ?? part.inline_data;
		if (!inlineData || typeof inlineData !== "object") {
			return undefined;
		}

		const data = inlineData.data;
		if (typeof data !== "string" || data.length === 0) {
			return undefined;
		}

		const mimeType =
			typeof inlineData.mimeType === "string"
				? inlineData.mimeType
				: typeof inlineData.mime_type === "string"
					? inlineData.mime_type
					: undefined;

		return { data, mimeType };
	}

	private static resolveGoogleInlineAssetKind(
		mimeType: string | undefined,
		options: ResponseFormatOptions,
	): "image" | "audio" | undefined {
		if (mimeType?.startsWith("image/")) {
			return "image";
		}

		if (mimeType?.startsWith("audio/")) {
			return "audio";
		}

		const modalityState = ResponseFormatter.getModalityState(options.modalities);
		if (modalityState.producesImages) {
			return "image";
		}

		if (modalityState.producesAudio) {
			return "audio";
		}

		return undefined;
	}

	private static async persistGoogleInlineAsset(
		asset: { data: string; mimeType?: string },
		kind: "image" | "audio",
		options: ResponseFormatOptions,
	): Promise<{ key?: string; url: string; mimeType: string }> {
		return await persistInlineGeneratedAsset(
			ResponseFormatter.getGeneratedMediaContext(options),
			asset,
			kind,
		);
	}

	private static stripGoogleInlineDataPayload(part: Record<string, any>): Record<string, any> {
		const inlineData = part.inlineData ?? part.inline_data;
		if (!inlineData || typeof inlineData !== "object") {
			return part;
		}

		const { data: _data, ...safeInlineData } = inlineData;
		if (part.inlineData) {
			return { ...part, inlineData: safeInlineData };
		}

		return { ...part, inline_data: safeInlineData };
	}

	private static stripGoogleResponseInlineData(data: any): any {
		if (!Array.isArray(data.candidates)) {
			return data;
		}

		return {
			...data,
			candidates: data.candidates.map((candidate: any) => ({
				...candidate,
				content: {
					...candidate.content,
					parts: Array.isArray(candidate.content?.parts)
						? candidate.content.parts.map((part: any) =>
								ResponseFormatter.stripGoogleInlineDataPayload(part),
							)
						: candidate.content?.parts,
				},
			})),
		};
	}

	private static getAudioContentType(format: string): string {
		const contentTypes: Record<string, string> = {
			wav: "audio/wav",
			mp3: "audio/mpeg",
			m4a: "audio/mp4",
			ogg: "audio/ogg",
			flac: "audio/flac",
		};

		return contentTypes[format] || "audio/mpeg";
	}

	private static async persistOpenAIMessageAudio(
		audio: Record<string, unknown>,
		options: ResponseFormatOptions,
	): Promise<{ key?: string; url: string; format: string }> {
		const audioData = audio.data;
		if (typeof audioData !== "string" || !audioData) {
			throw new AssistantError(
				"OpenAI audio response did not include audio data",
				ErrorType.PROVIDER_ERROR,
			);
		}

		const format = typeof audio.format === "string" ? audio.format : "mp3";
		const contentType = ResponseFormatter.getAudioContentType(format);

		if (!hasPrivateAssetStorage(ResponseFormatter.getGeneratedMediaContext(options))) {
			return {
				format,
				url: audioData.startsWith("data:") ? audioData : `data:${contentType};base64,${audioData}`,
			};
		}

		const storedAudio = await persistGeneratedAsset({
			mediaContext: ResponseFormatter.getGeneratedMediaContext(options),
			extension: format,
			data: base64ToBuffer(audioData),
			mimeType: contentType,
			filename: `audio.${format}`,
		});

		return {
			key: storedAudio.key,
			format,
			url: storedAudio.url,
		};
	}

	private static async formatOpenAIMessageAudio(
		data: any,
		message: any,
		textContent: string,
		options: ResponseFormatOptions,
	): Promise<any | undefined> {
		if (!message?.audio || typeof message.audio !== "object") {
			return undefined;
		}

		const audio = message.audio as Record<string, unknown>;
		if (typeof audio.data !== "string" || !audio.data) {
			return undefined;
		}

		const persisted = await ResponseFormatter.persistOpenAIMessageAudio(audio, options);
		const transcript =
			typeof audio.transcript === "string" && audio.transcript ? audio.transcript : textContent;
		const response = [
			...(transcript ? [{ type: "text" as const, text: transcript }] : []),
			{
				type: "audio_url" as const,
				audio_url: { url: persisted.url },
			},
		];
		const { data: _audioData, ...safeAudio } = audio;

		return {
			...data,
			...message,
			response,
			data: {
				...data.data,
				audio: {
					...safeAudio,
					...persisted,
					transcript,
				},
			},
		};
	}

	/**
	 * Format generic/unknown provider responses
	 * Attempts to extract content from common response formats
	 * @param data - The data to format
	 * @returns The formatted data
	 */
	private static formatGenericResponse(data: any, options: ResponseFormatOptions): any {
		if (data.response !== undefined) {
			return data;
		}

		let textContent = "";
		let thinkingContent = "";
		let signatureContent = "";

		if (data.choices?.[0]) {
			if (data.choices[0].message?.content) {
				textContent = data.choices[0].message.content;
			} else if (data.choices[0].delta?.content !== undefined) {
				textContent = data.choices[0].delta.content;
			} else if (data.choices[0].text) {
				textContent = data.choices[0].text;
			}
		} else if (data.delta?.text) {
			textContent = data.delta.text;
		} else if (data.content && typeof data.content === "string") {
			textContent = data.content;
		} else if (data.content && Array.isArray(data.content)) {
			textContent = data.content
				.filter((item: any) => item.type === "text" && item.text)
				.map((item: any) => item.text)
				.join(" ");

			const thinkingContentItem = data.content.find(
				(item: any) => item.type === "thinking" && item.thinking,
			);

			thinkingContent = thinkingContentItem?.thinking || "";
			signatureContent = thinkingContentItem?.signature || "";
		} else if (data.message?.content) {
			if (typeof data.message.content === "string") {
				textContent = data.message.content;
			} else if (Array.isArray(data.message.content)) {
				textContent = data.message.content
					.filter((item: any) => item.type === "text" && item.text)
					.map((item: any) => item.text)
					.join(" ");

				const thinkingContentItem = data.message.content.find(
					(item: any) => item.type === "thinking" && item.thinking,
				);

				thinkingContent = thinkingContentItem?.thinking || "";
				signatureContent = thinkingContentItem?.signature || "";
			}
		}

		const processedTextContent = !options.is_streaming
			? preprocessQwQResponse(textContent, options.model || data.model || "")
			: textContent;

		return {
			...data,
			response: processedTextContent,
			thinking: thinkingContent,
			signature: signatureContent,
		};
	}

	private static async formatOpenAIResponse(
		data: any,
		options: ResponseFormatOptions,
	): Promise<any> {
		if (data.object === "response" || Array.isArray(data.output)) {
			const outputText =
				typeof data.output_text === "string"
					? data.output_text
					: ResponseFormatter.extractOpenAIResponsesText(data.output);
			const base64Images = ResponseFormatter.extractOpenAIResponsesImages(data.output);
			const annotations = ResponseFormatter.extractOpenAIResponsesAnnotations(data.output);
			const toolCalls = ResponseFormatter.extractOpenAIResponsesToolCalls(data.output);
			const processedTextContent = !options.is_streaming
				? preprocessQwQResponse(outputText, options.model || data.model || "")
				: outputText;

			if (base64Images.length) {
				const uploads = await persistBase64GeneratedImages(
					ResponseFormatter.getGeneratedMediaContext(options),
					base64Images,
				);
				const imagesContent = uploads.urls.map((url) => ({
					type: "image_url",
					image_url: { url },
				}));

				return {
					...data,
					response: imagesContent,
					...(toolCalls.length ? { tool_calls: toolCalls } : {}),
					annotations,
					data: {
						openai_response_id: data.id,
						output: data.output,
						assets: uploads.metadata,
					},
				};
			}

			return {
				...data,
				response: processedTextContent,
				...(toolCalls.length ? { tool_calls: toolCalls } : {}),
				annotations,
				data: {
					...data.data,
					openai_response_id: data.id,
					output: data.output,
				},
			};
		}

		const modalityState = ResponseFormatter.getModalityState(options.modalities);
		const isImageType = modalityState.producesImages && !modalityState.producesText;
		if (isImageType && Array.isArray(data.data)) {
			const imageData = Array.isArray(data.data) ? data.data : [];
			const dataImageUrls = imageData.filter((item) => item.url).map((item) => item.url);
			const base64Images = imageData
				.map((item) => item.b64_json)
				.filter((value): value is string => typeof value === "string" && !!value);
			const revisedPrompt =
				data.revised_prompt || imageData.find((item) => item.revised_prompt)?.revised_prompt;

			const assets: Array<{
				key: string;
				url: string;
				originalUrl?: string;
				source?: "base64";
			}> = [];

			let imageUrls: string[] = [];
			if (dataImageUrls.length) {
				const uploads = await persistRemoteGeneratedAssets({
					mediaContext: ResponseFormatter.getGeneratedMediaContext(options),
					urls: dataImageUrls,
					fallback: {
						extension: "png",
						contentType: "image/png",
					},
				});
				imageUrls = uploads.urls;
				assets.push(...uploads.metadata);
			}

			if (base64Images.length) {
				const uploads = await persistBase64GeneratedImages(
					ResponseFormatter.getGeneratedMediaContext(options),
					base64Images,
				);
				imageUrls = [...imageUrls, ...uploads.urls];
				assets.push(...uploads.metadata);
			}

			if (!imageUrls.length) {
				return { ...data, response: [] };
			}

			const imagesContent = imageUrls.map((url) => ({
				type: "image_url",
				image_url: { url },
			}));

			const sanitizedData =
				revisedPrompt || assets.length
					? {
							...(revisedPrompt ? { revised_prompt: revisedPrompt } : {}),
							...(assets.length ? { assets } : {}),
						}
					: undefined;

			const { data: _rawData, ...rest } = data;
			const result: any = { ...rest, response: imagesContent };

			if (sanitizedData) {
				result.data = sanitizedData;
			}

			return result;
		}

		const message = data.choices?.[0]?.message;
		const textCompletion = data.choices?.[0]?.text;

		if (!message && typeof textCompletion === "string") {
			const processedTextCompletion = !options.is_streaming
				? preprocessQwQResponse(textCompletion, options.model || data.model || "")
				: textCompletion;

			return {
				...data,
				response: processedTextCompletion,
			};
		}

		const textContent = message?.content || "";

		const processedTextContent = !options.is_streaming
			? preprocessQwQResponse(textContent, options.model || data.model || "")
			: textContent;

		const audioResponse = await ResponseFormatter.formatOpenAIMessageAudio(
			data,
			message,
			processedTextContent,
			options,
		);
		if (audioResponse) {
			return audioResponse;
		}

		return { ...data, response: processedTextContent, ...message };
	}

	private static extractOpenAIResponsesText(output: any): string {
		if (!Array.isArray(output)) {
			return "";
		}

		return output
			.flatMap((item: any) => {
				if (typeof item?.text === "string") {
					return [item.text];
				}

				if (Array.isArray(item?.content)) {
					return item.content
						.map((content: any) => content?.text)
						.filter((text: unknown): text is string => typeof text === "string");
				}

				return [];
			})
			.join("");
	}

	private static extractOpenAIResponsesImages(output: any): string[] {
		if (!Array.isArray(output)) {
			return [];
		}

		return output
			.filter(
				(item: any) => item?.type === "image_generation_call" && typeof item.result === "string",
			)
			.map((item: any) => item.result);
	}

	private static extractOpenAIResponsesToolCalls(output: any): any[] {
		if (!Array.isArray(output)) {
			return [];
		}

		return output
			.filter((item: any) => item?.type === "function_call" && item.call_id && item.name)
			.map((item: any) => ({
				id: item.call_id,
				type: "function",
				function: {
					name: item.name,
					arguments: item.arguments || "{}",
				},
			}));
	}

	private static extractOpenAIResponsesAnnotations(output: any): any[] {
		if (!Array.isArray(output)) {
			return [];
		}

		return output.flatMap((item: any) => {
			if (!Array.isArray(item?.content)) {
				return [];
			}

			return item.content.flatMap((content: any) =>
				Array.isArray(content?.annotations) ? content.annotations : [],
			);
		});
	}

	private static formatOpenRouterResponse(data: any): any {
		const message = data.choices?.[0]?.message;
		const content = message?.content || "";

		return {
			...data,
			response: content,
		};
	}

	private static formatAnthropicResponse(data: any): any {
		if (!data.content) {
			return { ...data, response: "" };
		}

		const textContent = data.content
			.filter((content: any) => content.type === "text" && content.text)
			.map((content: any) => content.text)
			.join(" ");

		const thinkingContent = data.content.find(
			(content: any) => content.type === "thinking" && content.thinking,
		);

		return {
			...data,
			response: textContent,
			thinking: thinkingContent?.thinking || "",
			signature: thinkingContent?.signature || "",
		};
	}

	private static async formatGoogleStudioResponse(
		data: any,
		options: ResponseFormatOptions = {},
	): Promise<any> {
		if (!data.candidates || !data.candidates[0]?.content?.parts) {
			return { ...data, response: "", tool_calls: [] };
		}

		const parts = data.candidates[0].content.parts;
		const toolCalls: Record<string, any>[] = [];
		const responseParts: Array<Record<string, any>> = [];
		const assets: Array<{ key?: string; url: string; mimeType: string; type: "image" | "audio" }> =
			[];

		let textResponse = "";
		let thinkingResponse = "";

		for (const [index, part] of parts.entries()) {
			if (part.text) {
				if (part.thought) {
					thinkingResponse += (thinkingResponse ? "\n" : "") + part.text;
				} else {
					textResponse += (textResponse ? "\n" : "") + part.text;
				}
			} else if (part.functionCall) {
				const fc = part.functionCall;
				toolCalls.push({ name: fc.name, arguments: fc.args });
			} else if (part.executableCode) {
				const code = part.executableCode;
				const language = code.language?.toLowerCase() || "code";
				textResponse += `\n\n<artifact identifier="executable-code-${index}" type="application/code" language="${language}" title="Executable ${language} Code">${code.code}</artifact>`;
			} else if (part.codeExecutionResult) {
				const result = part.codeExecutionResult;
				if (result.output) {
					textResponse += `\n\n${result.output}\n\n`;
				}
			} else {
				const inlineAsset = ResponseFormatter.getGoogleInlineData(part);
				const kind = ResponseFormatter.resolveGoogleInlineAssetKind(inlineAsset?.mimeType, options);
				if (inlineAsset && kind) {
					const persisted = await ResponseFormatter.persistGoogleInlineAsset(
						inlineAsset,
						kind,
						options,
					);
					assets.push({ ...persisted, type: kind });
					responseParts.push(
						kind === "image"
							? {
									type: "image_url",
									image_url: { url: persisted.url },
								}
							: {
									type: "audio_url",
									audio_url: { url: persisted.url },
								},
					);
				}
			}
		}

		let newData = data.data;
		const searchGrounding = data.candidates[0].groundingMetadata;
		if (searchGrounding) {
			if (!newData) {
				newData = {};
			}

			// Remove the searchEntryPoint renderedContent and groundingSupports from the searchGrounding
			const cleanedSearchGrounding = {
				...searchGrounding,
				searchEntryPoint: {
					...searchGrounding.searchEntryPoint,
					renderedContent: undefined,
				},
				groundingSupports: {},
			};

			newData.searchGrounding = cleanedSearchGrounding;
		}

		const urlContextMetadata =
			data.candidates[0].urlContextMetadata ?? data.candidates[0].url_context_metadata;
		if (urlContextMetadata) {
			if (!newData) {
				newData = {};
			}

			newData.urlContext = urlContextMetadata;
		}

		if (assets.length > 0) {
			if (!newData) {
				newData = {};
			}

			newData.assets = assets;
		}

		const response =
			responseParts.length > 0
				? [...(textResponse ? [{ type: "text", text: textResponse }] : []), ...responseParts]
				: textResponse;
		const safeData =
			assets.length > 0 ? ResponseFormatter.stripGoogleResponseInlineData(data) : data;

		return {
			...safeData,
			response,
			thinking: thinkingResponse,
			data: newData,
			tool_calls: toolCalls,
		};
	}

	private static formatOllamaResponse(data: any): any {
		return { ...data, response: data.message?.content || "" };
	}

	private static async formatWorkersResponse(
		data: any,
		options: ResponseFormatOptions = {},
	): Promise<any> {
		const modalityState = ResponseFormatter.getModalityState(options.modalities);
		const isImageType = modalityState.producesImages && !modalityState.producesText;
		const isAudioType = modalityState.producesAudio && !modalityState.producesText;

		if (isImageType && (data.image || typeof data === "string")) {
			const imageContent = data.image || data;
			if (hasPrivateAssetStorage(ResponseFormatter.getGeneratedMediaContext(options))) {
				const imageBytes = base64ToBuffer(
					typeof imageContent === "string"
						? imageContent.replace(/^data:image\/\w+;base64,/, "")
						: imageContent,
				);
				const storedImage = await persistGeneratedAsset({
					mediaContext: ResponseFormatter.getGeneratedMediaContext(options),
					extension: "png",
					data: imageBytes,
					mimeType: "image/png",
					filename: "image.png",
				});
				return {
					...data,
					response: [
						{
							type: "image_url",
							image_url: { url: storedImage.url },
						},
					],
					data: { url: storedImage.url, key: storedImage.key, assetId: storedImage.assetId },
				};
			}
			return { ...data, response: imageContent };
		}

		if (isAudioType && (data.audio || typeof data === "string")) {
			const audioContent = data.audio || data;
			if (hasPrivateAssetStorage(ResponseFormatter.getGeneratedMediaContext(options))) {
				const audioBytes = base64ToBuffer(
					typeof audioContent === "string"
						? audioContent.replace(/^data:audio\/\w+;base64,/, "")
						: audioContent,
				);
				const storedAudio = await persistGeneratedAsset({
					mediaContext: ResponseFormatter.getGeneratedMediaContext(options),
					extension: "mp3",
					data: audioBytes,
					mimeType: "audio/mpeg",
					filename: "audio.mp3",
				});
				return {
					...data,
					response: [
						{
							type: "audio_url",
							audio_url: { url: storedAudio.url },
						},
					],
					data: { url: storedAudio.url, key: storedAudio.key, assetId: storedAudio.assetId },
				};
			}
			return { ...data, response: audioContent };
		}

		let textContent = "";
		if (data.response) {
			textContent = data.response;
		} else {
			textContent = data.result || "";
		}

		const processedTextContent = !options.is_streaming
			? preprocessQwQResponse(textContent, options.model || data.model || "")
			: textContent;

		return { ...data, response: processedTextContent };
	}

	private static async formatBedrockResponse(
		data: any,
		options: ResponseFormatOptions = {},
	): Promise<any> {
		const modalityState = ResponseFormatter.getModalityState(options.modalities);
		const isImageType = modalityState.producesImages && !modalityState.producesText;
		const isVideoType = modalityState.producesVideo && !modalityState.producesText;

		if (isVideoType) {
			return { ...data, response: data };
		}

		if (isImageType) {
			const images = data.images;
			if (!images || !Array.isArray(images) || images.length === 0) {
				throw new AssistantError("No images returned from Bedrock", ErrorType.PROVIDER_ERROR);
			}

			const image = images[0];
			if (hasPrivateAssetStorage(ResponseFormatter.getGeneratedMediaContext(options))) {
				const imageBytes = base64ToBuffer(
					typeof image === "string" ? image.replace(/^data:image\/\w+;base64,/, "") : image,
				);
				const storedImage = await persistGeneratedAsset({
					mediaContext: ResponseFormatter.getGeneratedMediaContext(options),
					extension: "png",
					data: imageBytes,
					mimeType: "image/png",
					filename: "image.png",
				});

				return {
					...data,
					response: [
						{
							type: "image_url",
							image_url: { url: storedImage.url },
						},
					],
					data: {
						assetId: storedImage.assetId,
						url: storedImage.url,
						key: storedImage.key,
					},
				};
			}
			return { ...data, response: image };
		}

		if (data.output?.message?.content?.[0]?.text) {
			return { ...data, response: data.output.message.content[0].text };
		}

		if (data.delta?.text) {
			return { ...data, response: data.delta.text };
		}

		if (typeof data.message === "string") {
			return { ...data, response: data.message };
		}

		return { ...data, response: "" };
	}

	private static async formatReplicateResponse(
		data: any,
		options: ResponseFormatOptions = {},
	): Promise<any> {
		const output =
			data?.images ??
			data?.output ??
			data?.prediction?.output ??
			data?.data?.output ??
			data?.response ??
			data?.data ??
			[];

		const strings = ResponseFormatter.collectStringsFromOutput(output).map((value) => value.trim());
		const urlStrings = strings.filter((value) => value.toLowerCase().startsWith("http"));
		const textStrings = strings.filter((value) => !value.toLowerCase().startsWith("http") && value);

		const modalityState = ResponseFormatter.getModalityState(options.modalities);
		const isImageType = modalityState.producesImages && !modalityState.producesText;
		const isVideoType = modalityState.producesVideo && !modalityState.producesText;
		const isAudioType = modalityState.producesAudio && !modalityState.producesText;
		const isTranscriptionType = modalityState.inputSet.has("audio") && modalityState.producesText;

		if (isImageType) {
			const imageUrls = ResponseFormatter.filterUrlsByExtension(urlStrings, [
				".png",
				".jpg",
				".jpeg",
				".webp",
				".gif",
			]);
			const candidateUrls = imageUrls.length ? imageUrls : urlStrings;
			if (!candidateUrls.length) {
				const fallbackText = textStrings.join("\n").trim();
				return { ...data, response: fallbackText };
			}

			let persistedUrls = candidateUrls;
			let metadata: Array<{ key: string; url: string; originalUrl: string }> = [];

			if (hasPrivateAssetStorage(ResponseFormatter.getGeneratedMediaContext(options))) {
				const uploads = await persistRemoteGeneratedAssets({
					mediaContext: ResponseFormatter.getGeneratedMediaContext(options),
					urls: candidateUrls,
					fallback: {
						extension: "png",
						contentType: "image/png",
					},
				});
				persistedUrls = uploads.urls;
				metadata = uploads.metadata;
			}

			const responseContent = persistedUrls.map((url) => ({
				type: "image_url" as const,
				image_url: { url },
			}));

			const result: any = { ...data, response: responseContent };
			if (metadata.length) {
				result.data = { ...data.data, assets: metadata };
			}
			return result;
		}

		if (isVideoType) {
			const videoUrls = ResponseFormatter.filterUrlsByExtension(urlStrings, [
				".mp4",
				".webm",
				".mov",
			]);
			const candidateUrls = videoUrls.length ? videoUrls : urlStrings;
			if (!candidateUrls.length) {
				const fallbackText = textStrings.join("\n").trim();
				return { ...data, response: fallbackText };
			}

			let persistedUrls = candidateUrls;
			let metadata: Array<{ key: string; url: string; originalUrl: string }> = [];

			if (hasPrivateAssetStorage(ResponseFormatter.getGeneratedMediaContext(options))) {
				const uploads = await persistRemoteGeneratedAssets({
					mediaContext: ResponseFormatter.getGeneratedMediaContext(options),
					urls: candidateUrls,
					fallback: {
						extension: "mp4",
						contentType: "video/mp4",
					},
				});
				persistedUrls = uploads.urls;
				metadata = uploads.metadata;
			}

			const responseContent = persistedUrls.map((url) => ({
				type: "video_url" as const,
				video_url: { url },
			}));

			const result: any = { ...data, response: responseContent };
			if (metadata.length) {
				result.data = { ...data.data, assets: metadata };
			}
			return result;
		}

		if (isAudioType) {
			const audioUrls = ResponseFormatter.filterUrlsByExtension(urlStrings, [
				".mp3",
				".wav",
				".ogg",
				".flac",
				".m4a",
			]);
			const candidateUrls = audioUrls.length ? audioUrls : urlStrings;
			if (!candidateUrls.length) {
				const fallbackText = textStrings.join("\n").trim();
				return { ...data, response: fallbackText };
			}

			let persistedUrls = candidateUrls;
			let metadata: Array<{ key: string; url: string; originalUrl: string }> = [];

			if (hasPrivateAssetStorage(ResponseFormatter.getGeneratedMediaContext(options))) {
				const uploads = await persistRemoteGeneratedAssets({
					mediaContext: ResponseFormatter.getGeneratedMediaContext(options),
					urls: candidateUrls,
					fallback: {
						extension: "mp3",
						contentType: "audio/mpeg",
					},
				});
				persistedUrls = uploads.urls;
				metadata = uploads.metadata;
			}

			const responseContent = persistedUrls.map((url) => ({
				type: "audio_url" as const,
				audio_url: { url },
			}));

			const result: any = { ...data, response: responseContent };
			if (metadata.length) {
				result.data = { ...data.data, assets: metadata };
			}
			return result;
		}

		const textCandidate = textStrings.join("\n").trim();
		if (isTranscriptionType || textCandidate) {
			return { ...data, response: textCandidate };
		}

		if (urlStrings.length) {
			const responseContent = urlStrings.map((url) => ({
				type: "text" as const,
				text: url,
			}));
			return { ...data, response: responseContent };
		}

		return { ...data, response: "" };
	}
}
