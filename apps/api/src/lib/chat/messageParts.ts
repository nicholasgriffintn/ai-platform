import type { Message, MessageContent, MessagePart } from "~/types";
import { safeParseJson } from "~/utils/json";

type UnknownRecord = Record<string, unknown>;

const FILE_ATTACHMENT_MIME_TYPES: Record<string, string> = {
	image: "image/*",
	document: "application/octet-stream",
	markdown_document: "text/markdown",
	audio: "audio/*",
	video: "video/*",
};

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isObjectOrArray(value: unknown): value is UnknownRecord | unknown[] {
	return isRecord(value) || Array.isArray(value);
}

function extractTimestamp(
	value: unknown,
	fallbackTimestamp?: number,
): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (
		typeof fallbackTimestamp === "number" &&
		Number.isFinite(fallbackTimestamp)
	) {
		return fallbackTimestamp;
	}
	return undefined;
}

function extractCommonPartFields(
	part: UnknownRecord,
	fallbackTimestamp?: number,
): Pick<MessagePart, "id" | "timestamp" | "metadata"> {
	return {
		id: typeof part.id === "string" ? part.id : undefined,
		timestamp: extractTimestamp(part.timestamp, fallbackTimestamp),
		metadata: isRecord(part.metadata) ? part.metadata : undefined,
	};
}

function parseToolInput(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}

	const parsed = safeParseJson(value);
	return parsed ?? value;
}

function toText(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value
		: undefined;
}

function createAttachmentFilePart(
	attachment: UnknownRecord,
	timestamp?: number,
): MessagePart | null {
	const type =
		typeof attachment.type === "string" ? attachment.type : "document";
	const mimeType =
		typeof attachment.mimeType === "string"
			? attachment.mimeType
			: FILE_ATTACHMENT_MIME_TYPES[type] || "application/octet-stream";

	return {
		type: "file",
		name: typeof attachment.name === "string" ? attachment.name : undefined,
		url: typeof attachment.url === "string" ? attachment.url : undefined,
		mimeType,
		sizeBytes:
			typeof attachment.sizeBytes === "number"
				? attachment.sizeBytes
				: undefined,
		timestamp,
	};
}

function appendFilePartFromContent(
	parts: MessagePart[],
	contentPart: MessageContent,
	timestamp?: number,
): void {
	if (contentPart.type === "image_url" && contentPart.image_url?.url) {
		parts.push({
			type: "file",
			url: contentPart.image_url.url,
			mimeType: "image/*",
			timestamp,
		});
		return;
	}

	if (contentPart.type === "audio_url" && contentPart.audio_url?.url) {
		parts.push({
			type: "file",
			url: contentPart.audio_url.url,
			mimeType: "audio/*",
			timestamp,
		});
		return;
	}

	if (contentPart.type === "video_url" && contentPart.video_url?.url) {
		parts.push({
			type: "file",
			url: contentPart.video_url.url,
			mimeType: "video/*",
			timestamp,
		});
		return;
	}

	if (contentPart.type === "document_url" && contentPart.document_url?.url) {
		parts.push({
			type: "file",
			url: contentPart.document_url.url,
			name: contentPart.document_url.name,
			mimeType: "application/octet-stream",
			timestamp,
		});
		return;
	}

	if (
		contentPart.type === "markdown_document" &&
		contentPart.markdown_document
	) {
		parts.push({
			type: "file",
			name: contentPart.markdown_document.name,
			mimeType: "text/markdown",
			metadata: {
				content: contentPart.markdown_document.markdown,
			},
			timestamp,
		});
		return;
	}

	if (contentPart.type === "input_audio" && contentPart.input_audio?.data) {
		parts.push({
			type: "file",
			mimeType: `audio/${contentPart.input_audio.format || "mp3"}`,
			metadata: {
				base64: contentPart.input_audio.data,
			},
			timestamp,
		});
	}
}

export function appendTextPart(
	parts: MessagePart[],
	text: string,
	timestamp?: number,
): void {
	if (!text) {
		return;
	}

	const lastPart = parts[parts.length - 1];
	if (lastPart?.type === "text") {
		lastPart.text += text;
		return;
	}

	parts.push({
		type: "text",
		text,
		timestamp,
	});
}

export function appendReasoningPart(
	parts: MessagePart[],
	reasoning: string,
	timestamp?: number,
): void {
	if (!reasoning) {
		return;
	}

	const lastPart = parts[parts.length - 1];
	if (lastPart?.type === "reasoning") {
		lastPart.text += reasoning;
		return;
	}

	parts.push({
		type: "reasoning",
		text: reasoning,
		collapsed: true,
		timestamp,
	});
}

function normalisePart(
	part: unknown,
	fallbackTimestamp?: number,
): MessagePart | null {
	if (!isRecord(part)) {
		return null;
	}

	if (!("type" in part) && typeof part.text === "string") {
		const text = toText(part.text);
		if (!text) {
			return null;
		}
		return {
			type: "text",
			text,
			timestamp: extractTimestamp(undefined, fallbackTimestamp),
		};
	}

	if (typeof part.type !== "string") {
		return null;
	}

	const commonFields = extractCommonPartFields(part, fallbackTimestamp);

	switch (part.type) {
		case "text": {
			const text = toText(part.text);
			return text ? { type: "text", text, ...commonFields } : null;
		}
		case "tool_use": {
			const name = toText(part.name);
			if (!name) {
				return null;
			}
			const input = parseToolInput(part.input);
			return {
				type: "tool_use",
				name,
				toolCallId:
					typeof part.toolCallId === "string"
						? part.toolCallId
						: typeof part.tool_call_id === "string"
							? part.tool_call_id
							: undefined,
				input:
					isObjectOrArray(input) || typeof input === "string"
						? input
						: undefined,
				...commonFields,
			};
		}
		case "tool_result": {
			return {
				type: "tool_result",
				name: typeof part.name === "string" ? part.name : undefined,
				toolCallId:
					typeof part.toolCallId === "string"
						? part.toolCallId
						: typeof part.tool_call_id === "string"
							? part.tool_call_id
							: undefined,
				status: typeof part.status === "string" ? part.status : undefined,
				content:
					typeof part.content === "string" || isObjectOrArray(part.content)
						? part.content
						: undefined,
				data: part.data,
				...commonFields,
			};
		}
		case "reasoning": {
			const text = toText(part.text);
			return text
				? {
						type: "reasoning",
						text,
						signature:
							typeof part.signature === "string" ? part.signature : undefined,
						collapsed:
							typeof part.collapsed === "boolean" ? part.collapsed : undefined,
						...commonFields,
					}
				: null;
		}
		case "snapshot": {
			const summary = toText(part.summary);
			return summary
				? {
						type: "snapshot",
						summary,
						title: typeof part.title === "string" ? part.title : undefined,
						...commonFields,
					}
				: null;
		}
		case "file":
			return {
				type: "file",
				name: typeof part.name === "string" ? part.name : undefined,
				url: typeof part.url === "string" ? part.url : undefined,
				mimeType: typeof part.mimeType === "string" ? part.mimeType : undefined,
				sizeBytes:
					typeof part.sizeBytes === "number" ? part.sizeBytes : undefined,
				...commonFields,
			};
		default:
			return null;
	}
}

export function normaliseMessageParts(
	parts: unknown,
	fallbackTimestamp?: number,
): MessagePart[] | undefined {
	if (!Array.isArray(parts)) {
		return undefined;
	}

	const normalised = parts
		.map((part) => normalisePart(part, fallbackTimestamp))
		.filter((part): part is MessagePart => part !== null);

	return normalised.length > 0 ? normalised : undefined;
}

export function buildMessageParts(message: Message): MessagePart[] | undefined {
	const timestamp = extractTimestamp(message.timestamp, Date.now());
	const parts: MessagePart[] = [];

	if (typeof message.content === "string") {
		appendTextPart(parts, message.content, timestamp);
	} else if (Array.isArray(message.content)) {
		for (const contentPart of message.content) {
			if (contentPart.type === "text" && contentPart.text) {
				appendTextPart(parts, contentPart.text, timestamp);
				continue;
			}

			if (contentPart.type === "thinking" && contentPart.thinking) {
				appendReasoningPart(parts, contentPart.thinking, timestamp);
				continue;
			}

			if (contentPart.type === "tool_result") {
				parts.push({
					type: "tool_result",
					content:
						typeof contentPart.content === "string" ||
						isObjectOrArray(contentPart.content)
							? contentPart.content
							: undefined,
					toolCallId: contentPart.tool_use_id,
					timestamp,
				});
				continue;
			}

			appendFilePartFromContent(parts, contentPart, timestamp);
		}
	} else if (isRecord(message.content)) {
		parts.push({
			type: "snapshot",
			summary: JSON.stringify(message.content),
			timestamp,
		});
	}

	if (Array.isArray(message.tool_calls)) {
		for (const toolCall of message.tool_calls) {
			const functionName = toolCall?.function?.name;
			if (typeof functionName !== "string" || !functionName) {
				continue;
			}

			const input = parseToolInput(toolCall.function.arguments);
			parts.push({
				type: "tool_use",
				name: functionName,
				toolCallId: typeof toolCall.id === "string" ? toolCall.id : undefined,
				input:
					isObjectOrArray(input) || typeof input === "string"
						? input
						: undefined,
				timestamp,
			});
		}
	}

	if (message.role === "tool") {
		parts.push({
			type: "tool_result",
			name: message.name,
			toolCallId: message.tool_call_id,
			status: message.status,
			content:
				typeof message.content === "string" || isObjectOrArray(message.content)
					? message.content
					: undefined,
			data: message.data ?? undefined,
			timestamp,
		});
	}

	if (isRecord(message.data) && Array.isArray(message.data.attachments)) {
		for (const attachment of message.data.attachments) {
			if (!isRecord(attachment)) {
				continue;
			}
			const filePart = createAttachmentFilePart(attachment, timestamp);
			if (filePart) {
				parts.push(filePart);
			}
		}
	}

	return parts.length > 0 ? parts : undefined;
}
