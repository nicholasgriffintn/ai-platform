import z from "zod/v4";

const partBaseSchema = z.object({
	id: z.string().optional(),
	timestamp: z.number().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const textPartSchema = partBaseSchema.extend({
	type: z.literal("text"),
	text: z.string(),
});

export const toolUsePartSchema = partBaseSchema.extend({
	type: z.literal("tool_use"),
	name: z.string(),
	toolCallId: z.string().optional(),
	input: z.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
});

export const toolResultPartSchema = partBaseSchema.extend({
	type: z.literal("tool_result"),
	name: z.string().optional(),
	toolCallId: z.string().optional(),
	status: z.string().optional(),
	content: z
		.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())])
		.optional(),
	data: z.unknown().optional(),
});

export const reasoningPartSchema = partBaseSchema.extend({
	type: z.literal("reasoning"),
	text: z.string(),
	signature: z.string().optional(),
	collapsed: z.boolean().optional(),
});

export const snapshotPartSchema = partBaseSchema.extend({
	type: z.literal("snapshot"),
	summary: z.string(),
	title: z.string().optional(),
});

export const compactionPartStatuses = ["pending", "completed"] as const;
export type CompactionPartStatus = (typeof compactionPartStatuses)[number];

export const compactionStatusLabels = {
	automaticCompleted: "Context automatically compacted",
	automaticPending: "Automatically compacting context",
	manualCompleted: "Context compacted",
	manualPending: "Compacting context",
} as const;

function readCompactionPartStatus(status: unknown): CompactionPartStatus | undefined {
	return status === "pending" || status === "completed" ? status : undefined;
}

export const compactionPartSchema = partBaseSchema.extend({
	type: z.literal("compaction"),
	status: z.enum(compactionPartStatuses),
	label: z.string().optional(),
});

export function hasCompactionPart(parts: unknown): boolean {
	return (
		Array.isArray(parts) &&
		parts.some((part) => {
			return (
				typeof part === "object" && part !== null && "type" in part && part.type === "compaction"
			);
		})
	);
}

export function hasValidCompactionPart(parts: unknown): boolean {
	return Array.isArray(parts) && parts.some((part) => compactionPartSchema.safeParse(part).success);
}

export function hasInvalidCompactionPart(parts: unknown): boolean {
	return (
		Array.isArray(parts) &&
		parts.some((part) => {
			return (
				typeof part === "object" &&
				part !== null &&
				"type" in part &&
				part.type === "compaction" &&
				!compactionPartSchema.safeParse(part).success
			);
		})
	);
}

export function isCompactionMarkerMessage(message: { role?: unknown; parts?: unknown }): boolean {
	return message.role === "compaction" || hasValidCompactionPart(message.parts);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isObjectOrArray(value: unknown): value is unknown[] | Record<string, unknown> {
	return Array.isArray(value) || isRecord(value);
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

function readPartBase(part: Record<string, unknown>, fallbackTimestamp?: number) {
	return {
		id: readOptionalString(part.id),
		timestamp: readOptionalNumber(part.timestamp, fallbackTimestamp),
		metadata: isRecord(part.metadata) ? part.metadata : undefined,
	};
}

export const filePartSchema = partBaseSchema.extend({
	type: z.literal("file"),
	name: z.string().optional(),
	url: z.string().optional(),
	mimeType: z.string().optional(),
	sizeBytes: z.number().int().nonnegative().optional(),
});

export const messagePartSchema = z.discriminatedUnion("type", [
	textPartSchema,
	toolUsePartSchema,
	toolResultPartSchema,
	reasoningPartSchema,
	snapshotPartSchema,
	compactionPartSchema,
	filePartSchema,
]);

export const messagePartsSchema = z.array(messagePartSchema);

export type MessagePart = z.infer<typeof messagePartSchema>;
export type CompactionMessagePart = Extract<MessagePart, { type: "compaction" }>;

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
