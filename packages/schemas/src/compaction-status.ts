import {
	compactionStatusLabels,
	hasInvalidCompactionPart,
	normaliseCompactionParts,
	type CompactionMessagePart,
} from "./message-parts";

export type CompactionStatusMessageContent = string | unknown[] | Record<string, unknown>;

export interface NormalisedCompactionStatusMessage {
	id: string;
	role: "compaction";
	content: CompactionStatusMessageContent;
	parts: CompactionMessagePart[];
	completion_id?: string;
	created?: number;
	timestamp?: number;
	model?: string;
	provider?: string;
	log_id?: string;
	status?: string;
	platform?: string;
	mode?: string;
	data?: Record<string, unknown>;
	usage?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessageContent(value: unknown): value is CompactionStatusMessageContent {
	return typeof value === "string" || Array.isArray(value) || isRecord(value);
}

type StringMetadataField =
	| "completion_id"
	| "model"
	| "provider"
	| "log_id"
	| "status"
	| "platform"
	| "mode";

type NumberMetadataField = "created" | "timestamp";
type RecordMetadataField = "data" | "usage";

const STRING_METADATA_FIELDS: readonly StringMetadataField[] = [
	"completion_id",
	"model",
	"provider",
	"log_id",
	"status",
	"platform",
	"mode",
];

const NUMBER_METADATA_FIELDS: readonly NumberMetadataField[] = ["created", "timestamp"];
const RECORD_METADATA_FIELDS: readonly RecordMetadataField[] = ["data", "usage"];

function hasCompactionMarkerRole(value: Record<string, unknown>): boolean {
	return value.role === "compaction";
}

function readCompactionLabel(content: unknown, parts: CompactionMessagePart[] | undefined): string {
	const partLabel =
		parts?.find((part) => part.status === "completed" && part.label?.trim())?.label?.trim() ??
		parts?.find((part) => part.label?.trim())?.label?.trim();

	return typeof content === "string" && content.trim()
		? content.trim()
		: (partLabel ?? compactionStatusLabels.manualCompleted);
}

function normaliseCompactionContent(
	content: unknown,
	parts: CompactionMessagePart[] | undefined,
): CompactionStatusMessageContent {
	if (typeof content === "string") {
		return content.trim() ? content : readCompactionLabel(content, parts);
	}

	return isMessageContent(content) ? content : readCompactionLabel(content, parts);
}

function hasCompletedCompactionPart(parts: CompactionMessagePart[]): boolean {
	return parts.some((part) => part.status === "completed");
}

function copyStringMetadata(
	message: NormalisedCompactionStatusMessage,
	source: Record<string, unknown>,
	field: StringMetadataField,
): void {
	const value = source[field];
	if (typeof value === "string") {
		message[field] = value;
	}
}

function copyNumberMetadata(
	message: NormalisedCompactionStatusMessage,
	source: Record<string, unknown>,
	field: NumberMetadataField,
): void {
	const value = source[field];
	if (typeof value === "number" && Number.isFinite(value)) {
		message[field] = value;
	}
}

function copyRecordMetadata(
	message: NormalisedCompactionStatusMessage,
	source: Record<string, unknown>,
	field: RecordMetadataField,
): void {
	const value = source[field];
	if (isRecord(value)) {
		message[field] = value;
	}
}

export function normaliseCompactionStatusMessage(
	value: unknown,
): NormalisedCompactionStatusMessage | undefined {
	if (!isRecord(value) || typeof value.id !== "string" || !value.id) {
		return undefined;
	}

	if (!hasCompactionMarkerRole(value)) {
		return undefined;
	}

	if (hasInvalidCompactionPart(value.parts)) {
		return undefined;
	}

	const parts = normaliseCompactionParts(value.parts);
	if (!parts) {
		return undefined;
	}

	if (!hasCompletedCompactionPart(parts)) {
		return undefined;
	}

	const message: NormalisedCompactionStatusMessage = {
		id: value.id,
		role: "compaction",
		content: normaliseCompactionContent(value.content, parts),
		parts,
	};

	STRING_METADATA_FIELDS.forEach((field) => copyStringMetadata(message, value, field));
	NUMBER_METADATA_FIELDS.forEach((field) => copyNumberMetadata(message, value, field));
	RECORD_METADATA_FIELDS.forEach((field) => copyRecordMetadata(message, value, field));

	return message;
}
