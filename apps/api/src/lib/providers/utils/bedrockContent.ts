import type {
	ChatCompletionParameters,
	Message,
	MessageContent,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export type BedrockContentBlock =
	| { text: string }
	| { image: { format: string; source: Record<string, any> } }
	| { video: { format: string; source: Record<string, any> } }
	| { audio: { format: string; source: Record<string, any> } }
	| { document: { format: string; source: Record<string, any> } };

type MediaKind = "image" | "audio" | "video" | "document";

export function formatBedrockMessages(
	params: ChatCompletionParameters,
): { role: Message["role"]; content: BedrockContentBlock[] }[] {
	return params.messages.map((message) => ({
		role: message.role,
		content: formatBedrockContentBlocks(message, params),
	}));
}

function formatBedrockContentBlocks(
	message: Message,
	params: ChatCompletionParameters,
): BedrockContentBlock[] {
	const { content } = message;

	if (typeof content === "string") {
		return [{ text: content }];
	}

	if (!Array.isArray(content)) {
		return [{ text: "" }];
	}

	const blocks = content
		.map((item) => toBedrockContentBlock(item, params))
		.filter((item): item is BedrockContentBlock => item !== null);

	if (blocks.length === 0) {
		return [{ text: "" }];
	}

	return blocks;
}

function toBedrockContentBlock(
	item: MessageContent | { text?: string } | string,
	params: ChatCompletionParameters,
): BedrockContentBlock | null {
	if (!item) {
		return null;
	}

	if (typeof item === "string") {
		return { text: item };
	}

	if ("text" in item && typeof item.text === "string") {
		if (!("type" in item) || item.type === "text") {
			return { text: item.text };
		}
	}

	const typedItem = item as MessageContent;

	switch (typedItem.type) {
		case "text":
			return { text: typedItem.text || "" };
		case "image_url":
			if (typedItem.image_url?.url) {
				return buildMediaContent(
					typedItem.image_url.url,
					params,
					"image",
					"png",
				);
			}
			return null;
		case "video_url":
			if (typedItem.video_url?.url) {
				return buildMediaContent(
					typedItem.video_url.url,
					params,
					"video",
					"mp4",
				);
			}
			return null;
		case "audio_url":
			if (typedItem.audio_url?.url) {
				return buildMediaContent(
					typedItem.audio_url.url,
					params,
					"audio",
					"mp3",
				);
			}
			return null;
		case "document_url":
			if (typedItem.document_url?.url) {
				return buildMediaContent(
					typedItem.document_url.url,
					params,
					"document",
					"pdf",
				);
			}
			return null;
		case "input_audio":
			if (typedItem.input_audio?.data) {
				return buildInputAudioContent(
					typedItem.input_audio.data,
					typedItem.input_audio.format,
				);
			}
			return null;
		case "tool_result":
			if (typedItem.content && typeof typedItem.content === "string") {
				return { text: typedItem.content };
			}
			return null;
		case "markdown_document":
		case "thinking":
			return null;
		default:
			return null;
	}
}

function buildMediaContent(
	url: string,
	params: ChatCompletionParameters,
	mediaKind: MediaKind,
	defaultFormat: string,
): BedrockContentBlock {
	const { format, source } = resolveMediaSource(
		url,
		params,
		mediaKind,
		defaultFormat,
	);

	return {
		[mediaKind]: {
			format,
			source,
		},
	} as BedrockContentBlock;
}

function buildInputAudioContent(
	data: string,
	format?: string,
): BedrockContentBlock {
	if (!data) {
		throw new AssistantError(
			"Audio data is required for Bedrock input_audio content",
			ErrorType.PARAMS_ERROR,
		);
	}

	const resolvedFormat = (format || "wav").toLowerCase();

	return {
		audio: {
			format: resolvedFormat,
			source: { bytes: data },
		},
	};
}

function resolveMediaSource(
	url: string,
	params: ChatCompletionParameters,
	mediaKind: MediaKind,
	defaultFormat: string,
): { format: string; source: Record<string, any> } {
	if (url.startsWith("data:")) {
		const parsed = parseDataUrl(url, mediaKind);
		return {
			format: mapMediaTypeToFormat(parsed.mediaType, defaultFormat, mediaKind),
			source: { bytes: parsed.data },
		};
	}

	if (url.startsWith("s3://")) {
		const format = inferFormatFromUrl(url, defaultFormat);
		const source: Record<string, any> = {
			s3Location: { uri: url },
		};

		if (params.env?.EMBEDDINGS_OUTPUT_BUCKET_OWNER) {
			source.s3Location.bucketOwner = params.env.EMBEDDINGS_OUTPUT_BUCKET_OWNER;
		}

		return { format, source };
	}

	throw new AssistantError(
		`Bedrock ${mediaKind} content must be provided as a data URL or S3 URI`,
		ErrorType.PARAMS_ERROR,
	);
}

function parseDataUrl(
	dataUrl: string,
	mediaKind: MediaKind,
): { mediaType: string; data: string } {
	const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

	if (!match) {
		throw new AssistantError(
			`Invalid ${mediaKind} data URL provided for Bedrock content`,
			ErrorType.PARAMS_ERROR,
		);
	}

	return { mediaType: match[1], data: match[2] };
}

function mapMediaTypeToFormat(
	mediaType: string,
	fallback: string,
	mediaKind: MediaKind,
): string {
	const [type, rawSubtype] = mediaType.split("/");
	const subtype = rawSubtype?.split("+")[0]?.toLowerCase();

	if (!subtype) {
		return fallback;
	}

	if (mediaKind === "image") {
		if (subtype === "jpeg" || subtype === "jpg") {
			return "jpeg";
		}
		if (subtype === "tif") {
			return "tiff";
		}
		return subtype;
	}

	if (mediaKind === "audio") {
		if (subtype === "mpeg" || subtype === "mp3") {
			return "mp3";
		}
		if (subtype === "x-wav") {
			return "wav";
		}
		return subtype;
	}

	if (mediaKind === "video") {
		if (subtype === "quicktime") {
			return "quicktime";
		}
		if (subtype === "mp4" || subtype === "mpeg4") {
			return "mp4";
		}
		if (subtype === "mpeg") {
			return "mpeg";
		}
		return subtype;
	}

	if (mediaKind === "document") {
		if (subtype === "pdf") {
			return "pdf";
		}
		if (subtype === "json") {
			return "json";
		}
		if (subtype === "plain") {
			return "txt";
		}
		return subtype;
	}

	return fallback;
}

function inferFormatFromUrl(url: string, fallback: string): string {
	const extensionMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);

	if (!extensionMatch) {
		return fallback;
	}

	const extension = extensionMatch[1].toLowerCase();

	switch (extension) {
		case "jpg":
		case "jpeg":
			return "jpeg";
		case "png":
		case "gif":
		case "webp":
		case "bmp":
		case "tiff":
			return extension === "tiff" ? "tiff" : extension;
		case "tif":
			return "tiff";
		case "mp3":
			return "mp3";
		case "wav":
			return "wav";
		case "mp4":
			return "mp4";
		case "mov":
			return "quicktime";
		case "mpeg":
		case "mpg":
			return "mpeg";
		case "pdf":
			return "pdf";
		case "txt":
			return "txt";
		case "json":
			return "json";
		default:
			return extension;
	}
}
