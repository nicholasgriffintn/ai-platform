export interface MessagePartBase {
	id?: string;
	timestamp?: number;
	metadata?: Record<string, unknown>;
}

export interface TextMessagePart extends MessagePartBase {
	type: "text";
	text: string;
}

export interface ToolUseMessagePart extends MessagePartBase {
	type: "tool_use";
	name: string;
	toolCallId?: string;
	input?: string | unknown[] | Record<string, unknown>;
}

export interface ToolResultMessagePart extends MessagePartBase {
	type: "tool_result";
	name?: string;
	toolCallId?: string;
	status?: string;
	content?: string | unknown[] | Record<string, unknown>;
	data?: unknown;
}

export interface ReasoningMessagePart extends MessagePartBase {
	type: "reasoning";
	text: string;
	signature?: string;
	collapsed?: boolean;
}

export interface SnapshotMessagePart extends MessagePartBase {
	type: "snapshot";
	summary: string;
	title?: string;
}

export const compactionPartStatuses = ["pending", "completed"] as const;
export type CompactionPartStatus = (typeof compactionPartStatuses)[number];

export interface CompactionMessagePart extends MessagePartBase {
	type: "compaction";
	status: CompactionPartStatus;
	label?: string;
}

export interface FileMessagePart extends MessagePartBase {
	type: "file";
	name?: string;
	url?: string;
	mimeType?: string;
	sizeBytes?: number;
}

export type MessagePart =
	| TextMessagePart
	| ToolUseMessagePart
	| ToolResultMessagePart
	| ReasoningMessagePart
	| SnapshotMessagePart
	| CompactionMessagePart
	| FileMessagePart;

export const compactionStatusLabels = {
	automaticCompleted: "Context automatically compacted",
	automaticPending: "Automatically compacting context",
	manualCompleted: "Context compacted",
	manualPending: "Compacting context",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isObjectOrArray(value: unknown): value is unknown[] | Record<string, unknown> {
	return Array.isArray(value) || isRecord(value);
}

function readCompactionPartStatus(status: unknown): CompactionPartStatus | undefined {
	return status === "pending" || status === "completed" ? status : undefined;
}

function readOptionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function readOptionalNumber(value: unknown, fallback?: number): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	return typeof fallback === "number" && Number.isFinite(fallback) ? fallback : undefined;
}

function readPayload(value: unknown): string | unknown[] | Record<string, unknown> | undefined {
	if (typeof value === "string" || isObjectOrArray(value)) {
		return value;
	}

	return undefined;
}

function readToolCallId(part: Record<string, unknown>): string | undefined {
	return readOptionalString(part.toolCallId) ?? readOptionalString(part.tool_call_id);
}

function parseToolInput(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}

	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function readPartBase(part: Record<string, unknown>, fallbackTimestamp?: number): MessagePartBase {
	return {
		id: readOptionalString(part.id),
		timestamp: readOptionalNumber(part.timestamp, fallbackTimestamp),
		metadata: isRecord(part.metadata) ? part.metadata : undefined,
	};
}

function isValidPartBase(part: Record<string, unknown>): boolean {
	return (
		(part.id === undefined || typeof part.id === "string") &&
		(part.timestamp === undefined ||
			(typeof part.timestamp === "number" && Number.isFinite(part.timestamp))) &&
		(part.metadata === undefined || isRecord(part.metadata))
	);
}

function isValidCompactionPart(part: unknown): part is CompactionMessagePart {
	return (
		isRecord(part) &&
		part.type === "compaction" &&
		isValidPartBase(part) &&
		readCompactionPartStatus(part.status) !== undefined &&
		(part.label === undefined || typeof part.label === "string")
	);
}

export function hasCompactionPart(parts: unknown): boolean {
	return Array.isArray(parts) && parts.some((part) => isRecord(part) && part.type === "compaction");
}

export function hasValidCompactionPart(parts: unknown): boolean {
	return Array.isArray(parts) && parts.some(isValidCompactionPart);
}

export function hasInvalidCompactionPart(parts: unknown): boolean {
	return (
		Array.isArray(parts) &&
		parts.some(
			(part) => isRecord(part) && part.type === "compaction" && !isValidCompactionPart(part),
		)
	);
}

export function isCompactionMarkerMessage(message: { role?: unknown; parts?: unknown }): boolean {
	return message.role === "compaction" || hasValidCompactionPart(message.parts);
}

function normaliseMessagePart(part: unknown, fallbackTimestamp?: number): MessagePart | null {
	if (!isRecord(part)) {
		return null;
	}

	if (typeof part.type !== "string" && typeof part.text === "string") {
		return {
			type: "text",
			text: part.text,
			timestamp: readOptionalNumber(undefined, fallbackTimestamp),
		};
	}

	if (typeof part.type !== "string") {
		return null;
	}

	const base = readPartBase(part, fallbackTimestamp);

	switch (part.type) {
		case "text":
			return typeof part.text === "string" ? { ...base, type: "text", text: part.text } : null;
		case "tool_use": {
			if (typeof part.name !== "string") {
				return null;
			}
			const input = parseToolInput(part.input);
			return {
				...base,
				type: "tool_use",
				name: part.name,
				toolCallId: readToolCallId(part),
				input: readPayload(input),
			};
		}
		case "tool_result":
			return {
				...base,
				type: "tool_result",
				name: readOptionalString(part.name),
				toolCallId: readToolCallId(part),
				status: readOptionalString(part.status),
				content: readPayload(part.content),
				data: part.data,
			};
		case "reasoning":
			return typeof part.text === "string"
				? {
						...base,
						type: "reasoning",
						text: part.text,
						signature: readOptionalString(part.signature),
						collapsed: typeof part.collapsed === "boolean" ? part.collapsed : undefined,
					}
				: null;
		case "snapshot":
			return typeof part.summary === "string"
				? {
						...base,
						type: "snapshot",
						summary: part.summary,
						title: readOptionalString(part.title),
					}
				: null;
		case "compaction": {
			const status = readCompactionPartStatus(part.status);
			if (status === undefined) {
				return null;
			}
			return {
				...base,
				type: "compaction",
				status,
				label: readOptionalString(part.label),
			};
		}
		case "file":
			return {
				...base,
				type: "file",
				name: readOptionalString(part.name),
				url: readOptionalString(part.url),
				mimeType: readOptionalString(part.mimeType),
				sizeBytes: readOptionalNumber(part.sizeBytes),
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

	const normalised = parts.flatMap((part) => {
		const normalisedPart = normaliseMessagePart(part, fallbackTimestamp);
		return normalisedPart ? [normalisedPart] : [];
	});

	return normalised.length > 0 ? normalised : undefined;
}

export function normaliseCompactionParts(
	parts: unknown,
	fallbackTimestamp?: number,
): CompactionMessagePart[] | undefined {
	const normalised = normaliseMessageParts(parts, fallbackTimestamp)?.filter(
		(part): part is CompactionMessagePart => part.type === "compaction",
	);

	return normalised && normalised.length > 0 ? normalised : undefined;
}
