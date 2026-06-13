import { MessageFormatter } from "~/lib/formatter";
import type { CreateChatCompletionsResponse, Message, MessageContent } from "~/types";
import { AssistantError, ErrorType } from "./errors";

export function formatMessages(
	provider: string,
	messageHistory: Message[],
	system_prompt?: string,
	model?: string,
): Message[] {
	return MessageFormatter.formatMessages(messageHistory, {
		provider,
		model,
		system_prompt,
		maxTokens: 0,
		truncationStrategy: "tail",
	});
}

export function formatTextGenerationPrompt(
	provider: string,
	messageHistory: Message[],
	system_prompt?: string,
	model?: string,
): string {
	return MessageFormatter.formatTextGenerationPrompt(messageHistory, {
		provider,
		model,
		system_prompt,
		maxTokens: 0,
		truncationStrategy: "tail",
	});
}

export function stringifyMessageContent(content: unknown): string {
	return MessageFormatter.stringifyMessageContent(content);
}

export interface ChatCompletionNotification {
	body: string;
	mediaUrls: string[];
}

export interface MessageMediaInput {
	url: string;
	mimeType?: string;
}

const INBOUND_MEDIA_LIMIT = 5;
const IMAGE_URL_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;

function isMessagingMediaUrl(value: string): boolean {
	const trimmed = value.trim();
	return trimmed.startsWith("https://") || trimmed.startsWith("s3://");
}

function isInboundMediaUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		return false;
	}

	return url.protocol === "https:" && !url.username && !url.password;
}

function isImageMedia(value: MessageMediaInput): boolean {
	const mimeType = value.mimeType?.split(";")[0]?.trim().toLowerCase();
	return Boolean(mimeType?.startsWith("image/") || IMAGE_URL_EXTENSION_PATTERN.test(value.url));
}

function normaliseInboundMedia(media: MessageMediaInput[] | undefined): MessageMediaInput[] {
	const seen = new Set<string>();
	const normalised: MessageMediaInput[] = [];

	for (const item of media ?? []) {
		const url = item.url.trim();
		if (!url || seen.has(url) || !isInboundMediaUrl(url)) {
			continue;
		}

		seen.add(url);
		normalised.push({
			url,
			...(item.mimeType?.trim() ? { mimeType: item.mimeType.trim() } : {}),
		});

		if (normalised.length >= INBOUND_MEDIA_LIMIT) {
			break;
		}
	}

	return normalised;
}

export function buildInboundMessageContent(params: {
	body: string;
	media?: MessageMediaInput[];
}): string | MessageContent[] {
	const body = params.body.trim();
	const media = normaliseInboundMedia(params.media);
	if (media.length === 0) {
		return body;
	}

	const content: MessageContent[] = [];
	if (body) {
		content.push({ type: "text", text: body });
	}

	const unsupportedMediaUrls: string[] = [];
	for (const item of media) {
		if (isImageMedia(item)) {
			content.push({
				type: "image_url",
				image_url: {
					url: item.url,
				},
			});
		} else {
			unsupportedMediaUrls.push(item.url);
		}
	}

	if (unsupportedMediaUrls.length > 0) {
		content.push({
			type: "text",
			text: `Attached media URLs: ${unsupportedMediaUrls.join(", ")}`,
		});
	}

	return content.length > 0 ? content : "Incoming message contained unsupported media.";
}

function addMessagingMediaUrl(urls: string[], value: unknown): void {
	if (typeof value !== "string" || !isMessagingMediaUrl(value)) {
		return;
	}

	const trimmed = value.trim();
	if (!urls.includes(trimmed)) {
		urls.push(trimmed);
	}
}

function extractTextFromMessageContent(content: string | MessageContent[] | undefined): string {
	if (typeof content === "string") {
		return content.trim();
	}

	if (!Array.isArray(content)) {
		return "";
	}

	return content
		.map((part) => (part.type === "text" && typeof part.text === "string" ? part.text.trim() : ""))
		.filter(Boolean)
		.join("\n")
		.trim();
}

function addMediaUrlsFromMessageContent(
	urls: string[],
	content: string | MessageContent[] | undefined,
) {
	if (!Array.isArray(content)) {
		return;
	}

	for (const part of content) {
		addMessagingMediaUrl(urls, part.image_url?.url);
		addMessagingMediaUrl(urls, part.audio_url?.url);
		addMessagingMediaUrl(urls, part.video_url?.url);
	}
}

function addMediaUrlsFromData(urls: string[], data: Record<string, unknown> | undefined): void {
	if (!data) {
		return;
	}

	const explicitUrlFields = [
		"imageUrl",
		"image_url",
		"audioUrl",
		"audio_url",
		"videoUrl",
		"video_url",
		"screenshotUrl",
		"drawingUrl",
		"paintingUrl",
	];

	for (const key of explicitUrlFields) {
		addMessagingMediaUrl(urls, data[key]);
	}

	const assets = data.assets;
	if (Array.isArray(assets)) {
		for (const asset of assets) {
			if (asset && typeof asset === "object" && "url" in asset) {
				addMessagingMediaUrl(urls, asset.url);
			}
		}
	}

	const mediaUrls = data.mediaUrls;
	if (Array.isArray(mediaUrls)) {
		for (const mediaUrl of mediaUrls) {
			addMessagingMediaUrl(urls, mediaUrl);
		}
	}

	const notification = data.notification;
	if (notification && typeof notification === "object" && "mediaUrls" in notification) {
		const notificationMediaUrls = notification.mediaUrls;
		if (Array.isArray(notificationMediaUrls)) {
			for (const mediaUrl of notificationMediaUrls) {
				addMessagingMediaUrl(urls, mediaUrl);
			}
		}
	}
}

export function extractChatCompletionText(
	response: CreateChatCompletionsResponse | Response,
	options?: {
		streamingMessage?: string;
		fallback?: string;
	},
): string {
	if (response instanceof Response) {
		throw new AssistantError(
			options?.streamingMessage ?? "Chat completion text cannot be extracted from a stream",
			ErrorType.PARAMS_ERROR,
		);
	}

	const content = response.choices?.[0]?.message?.content;
	const text = extractTextFromMessageContent(content);
	if (text) {
		return text;
	}

	return options?.fallback ?? "I could not generate a text response.";
}

export function extractChatCompletionNotification(
	response: CreateChatCompletionsResponse | Response,
	options?: {
		streamingMessage?: string;
		fallback?: string;
	},
): ChatCompletionNotification {
	if (response instanceof Response) {
		throw new AssistantError(
			options?.streamingMessage ?? "Chat completion notification cannot be extracted from a stream",
			ErrorType.PARAMS_ERROR,
		);
	}

	const message = response.choices?.[0]?.message;
	const mediaUrls: string[] = [];
	for (const choice of response.choices ?? []) {
		addMediaUrlsFromMessageContent(mediaUrls, choice.message?.content);
		addMediaUrlsFromData(mediaUrls, choice.message?.data);
	}

	return {
		body: extractChatCompletionText(response, options),
		mediaUrls,
	};
}
