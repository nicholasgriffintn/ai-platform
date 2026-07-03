import {
	hasCompactionPart as hasCompactionMessagePart,
	isCompactionMarkerMessage as isSchemaCompactionMarkerMessage,
	normaliseMessageParts as normaliseSchemaMessageParts,
} from "@assistant/schemas";
import type { Message, MessageContent, MessagePart } from "~/types";
import { isRecord, isObjectOrArray } from "~/utils/objects";

type UnknownRecord = Record<string, unknown>;

const FILE_ATTACHMENT_MIME_TYPES: Record<string, string> = {
	image: "image/*",
	document: "application/octet-stream",
	markdown_document: "text/markdown",
	audio: "audio/*",
	video: "video/*",
};

function extractTimestamp(value: unknown, fallbackTimestamp?: number): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof fallbackTimestamp === "number" && Number.isFinite(fallbackTimestamp)) {
		return fallbackTimestamp;
	}
	return undefined;
}

function createAttachmentFilePart(
	attachment: UnknownRecord,
	timestamp?: number,
): MessagePart | null {
	const type = typeof attachment.type === "string" ? attachment.type : "document";
	const mimeType =
		typeof attachment.mimeType === "string"
			? attachment.mimeType
			: FILE_ATTACHMENT_MIME_TYPES[type] || "application/octet-stream";

	return {
		type: "file",
		name: typeof attachment.name === "string" ? attachment.name : undefined,
		url: typeof attachment.url === "string" ? attachment.url : undefined,
		mimeType,
		sizeBytes: typeof attachment.sizeBytes === "number" ? attachment.sizeBytes : undefined,
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

	if (contentPart.type === "markdown_document" && contentPart.markdown_document) {
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

export function appendTextPart(parts: MessagePart[], text: string, timestamp?: number): void {
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

export function normaliseMessageParts(
	parts: unknown,
	fallbackTimestamp?: number,
): MessagePart[] | undefined {
	return normaliseSchemaMessageParts(parts, fallbackTimestamp);
}

export function hasSnapshotPart(message: Pick<Message, "parts">): boolean {
	return Array.isArray(message.parts) && message.parts.some((part) => part.type === "snapshot");
}

export function hasCompactionPart(message: { parts?: unknown }): boolean {
	return hasCompactionMessagePart(message.parts);
}

export function isCompactionMarkerMessage(message: { role?: unknown; parts?: unknown }): boolean {
	return isSchemaCompactionMarkerMessage(message);
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
						typeof contentPart.content === "string" || isObjectOrArray(contentPart.content)
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
		appendTextPart(parts, JSON.stringify(message.content), timestamp);
	}

	if (Array.isArray(message.tool_calls)) {
		for (const toolCall of message.tool_calls) {
			const functionName = toolCall?.function?.name;
			if (typeof functionName !== "string" || !functionName) {
				continue;
			}

			const toolUsePart = normaliseMessageParts([
				{
					type: "tool_use",
					name: functionName,
					toolCallId: typeof toolCall.id === "string" ? toolCall.id : undefined,
					input: toolCall.function.arguments,
					timestamp,
				},
			])?.[0];
			if (toolUsePart?.type === "tool_use") {
				parts.push(toolUsePart);
			}
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
