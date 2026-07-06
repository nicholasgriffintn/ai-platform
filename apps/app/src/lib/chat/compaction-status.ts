import {
	compactionStatusLabels,
	isCompactionMarkerMessage as isSchemaCompactionMarkerMessage,
	normaliseCompactionStatusMessage,
} from "@assistant/schemas/compaction-status";
import type { Message, MessageContent } from "~/types";
import { isRecord } from "../objects";

function isMessageContentPart(value: unknown): value is MessageContent {
	return isRecord(value) && typeof value.type === "string";
}

export function getCompactionMessageLabel(message: unknown): string | null {
	const compactionMessage = normaliseCompactionStatusMessage(message);
	if (!compactionMessage) {
		return null;
	}

	const compactionPart =
		compactionMessage.parts.find(
			(part) => part.type === "compaction" && part.status === "completed",
		) ?? compactionMessage.parts.find((part) => part.type === "compaction");
	if (compactionPart?.label?.trim()) {
		return compactionPart.label.trim();
	}

	return typeof compactionMessage.content === "string" && compactionMessage.content.trim()
		? compactionMessage.content.trim()
		: compactionStatusLabels.manualCompleted;
}

export function isCompactionMarkerMessage(message: unknown): boolean {
	if (!isRecord(message)) {
		return false;
	}

	return isSchemaCompactionMarkerMessage(message);
}

export function isCompactionLoadingMessage(message: string): boolean {
	return message.toLowerCase().includes("compacting context");
}

function readAppMessageContent(content: unknown): Message["content"] {
	if (typeof content === "string" || isRecord(content)) {
		return content;
	}

	if (Array.isArray(content) && content.every(isMessageContentPart)) {
		return content;
	}

	return compactionStatusLabels.manualCompleted;
}

export function readCompactionStatusMessage(value: unknown): Message | null {
	const message = normaliseCompactionStatusMessage(value);
	if (!message) {
		return null;
	}

	return {
		...message,
		role: "compaction",
		content: readAppMessageContent(message.content),
	};
}
