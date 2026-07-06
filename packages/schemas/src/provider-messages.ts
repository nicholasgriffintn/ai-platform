import {
	hasCompactionPart,
	isCompactionMarkerMessage,
	normaliseMessageParts,
	type MessagePart,
} from "./message-part-utils";
import type { MessageRole } from "./shared";

export type ProviderChatMessageRole = Exclude<MessageRole, "compaction">;
export type ProviderChatMessageContent =
	| string
	| ProviderChatMessageContentPart[]
	| Record<string, unknown>;

export interface ProviderChatMessage extends Record<string, unknown> {
	id?: string;
	role: ProviderChatMessageRole;
	content?: ProviderChatMessageContent;
	parts?: unknown;
	tool_calls?: unknown[];
}

export interface ProviderChatMessageContentPart extends Record<string, unknown> {
	type: string;
}

export interface NormalisedProviderChatMessage extends Record<string, unknown> {
	id?: string;
	role: ProviderChatMessageRole;
	content: ProviderChatMessageContent;
	name?: string;
	status?: string;
	data?: Record<string, unknown>;
	completion_id?: string;
	created?: number;
	model?: string;
	provider?: string;
	log_id?: string;
	citations?: string[];
	app?: string;
	mode?: string;
	parent_message_id?: string;
	tool_call_id?: string;
	tool_call_arguments?: string | Record<string, unknown>;
	tool_calls?: unknown[];
	timestamp?: number | string;
	platform?: string;
	usage?: Record<string, unknown>;
	parts?: MessagePart[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProviderChatMessageRole(value: unknown): value is ProviderChatMessageRole {
	return (
		value === "user" ||
		value === "assistant" ||
		value === "system" ||
		value === "tool" ||
		value === "developer"
	);
}

function isContentPart(value: unknown): value is ProviderChatMessageContentPart {
	return isRecord(value) && typeof value.type === "string";
}

function isProviderChatMessageContent(value: unknown): value is ProviderChatMessageContent {
	return (
		typeof value === "string" ||
		isRecord(value) ||
		(Array.isArray(value) && value.every(isContentPart))
	);
}

function hasProviderPayload(value: Record<string, unknown>): boolean {
	return (
		isProviderChatMessageContent(value.content) ||
		(Array.isArray(value.tool_calls) && value.tool_calls.length > 0)
	);
}

function readProviderContent(content: ProviderChatMessage["content"]): ProviderChatMessageContent {
	return isProviderChatMessageContent(content) ? content : "";
}

function readOptionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalTimestamp(value: unknown): number | string | undefined {
	if (typeof value === "string") {
		return value;
	}

	return readOptionalNumber(value);
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
	return isRecord(value) ? value : undefined;
}

function readOptionalStringArray(value: unknown): string[] | undefined {
	return Array.isArray(value) && value.every((item) => typeof item === "string")
		? value
		: undefined;
}

function readOptionalToolCallArguments(
	value: unknown,
): string | Record<string, unknown> | undefined {
	return typeof value === "string" || isRecord(value) ? value : undefined;
}

export function isProviderChatMessage(value: unknown): value is ProviderChatMessage {
	if (!isRecord(value)) {
		return false;
	}

	if (typeof value.id !== "undefined" && typeof value.id !== "string") {
		return false;
	}

	if (!isProviderChatMessageRole(value.role) || !hasProviderPayload(value)) {
		return false;
	}

	return !isCompactionMarkerMessage(value) && !hasCompactionPart(value.parts);
}

export function normaliseProviderChatMessage(
	value: unknown,
): NormalisedProviderChatMessage | undefined {
	if (!isProviderChatMessage(value)) {
		return undefined;
	}

	const message: NormalisedProviderChatMessage = {
		role: value.role,
		content: readProviderContent(value.content),
	};

	const optionalFields = {
		id: readOptionalString(value.id),
		name: readOptionalString(value.name),
		status: readOptionalString(value.status),
		data: readOptionalRecord(value.data),
		completion_id: readOptionalString(value.completion_id),
		created: readOptionalNumber(value.created),
		model: readOptionalString(value.model),
		provider: readOptionalString(value.provider),
		log_id: readOptionalString(value.log_id),
		citations: readOptionalStringArray(value.citations),
		app: readOptionalString(value.app),
		mode: readOptionalString(value.mode),
		parent_message_id: readOptionalString(value.parent_message_id),
		tool_call_id: readOptionalString(value.tool_call_id),
		tool_call_arguments: readOptionalToolCallArguments(value.tool_call_arguments),
		tool_calls: Array.isArray(value.tool_calls) ? value.tool_calls : undefined,
		timestamp: readOptionalTimestamp(value.timestamp),
		platform: readOptionalString(value.platform),
		usage: readOptionalRecord(value.usage),
		parts: normaliseMessageParts(value.parts),
	};

	return Object.assign(
		message,
		Object.fromEntries(Object.entries(optionalFields).filter(([, field]) => field !== undefined)),
	);
}

export function toProviderChatMessages(
	messages: readonly unknown[] | null | undefined,
): NormalisedProviderChatMessage[] {
	return messages?.flatMap((message) => normaliseProviderChatMessage(message) ?? []) ?? [];
}
