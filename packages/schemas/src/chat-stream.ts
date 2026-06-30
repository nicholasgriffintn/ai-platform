import z from "zod/v4";

import { messagePartSchema, type MessagePart } from "./message-parts";

export interface ChatStreamToolCall {
	id?: string;
	type?: "function";
	function: {
		name: string;
		arguments: string | Record<string, unknown>;
	};
	index?: number;
}

export interface ChatStreamMessage {
	role: "assistant" | "tool";
	content: string | unknown[];
	parts?: MessagePart[];
	reasoning?: {
		collapsed: boolean;
		content: string;
	};
	id: string;
	created?: number;
	timestamp?: number;
	model?: string;
	provider?: string;
	platform?: string;
	citations?: string[] | null;
	usage?: unknown;
	log_id?: string;
	name?: string;
	tool_call_id?: string;
	tool_call_arguments?: string | Record<string, unknown>;
	tool_calls?: ChatStreamToolCall[];
	status?: string | null;
	data?: unknown;
}

export type ChatStreamUpdate =
	| { type: "assistant_metadata"; message: ChatStreamMessage }
	| { type: "assistant_delta"; content: string; reasoning?: string }
	| { type: "assistant_final"; message: ChatStreamMessage }
	| { type: "tool_result"; message: ChatStreamMessage }
	| { type: "state"; state: string; event: Record<string, unknown> }
	| { type: "done"; message?: ChatStreamMessage };

export interface ChatStreamAssemblerOptions {
	model?: string;
	createId?: () => string;
	now?: () => number;
}

export interface ChatStreamAssembler {
	ingest(event: unknown): ChatStreamUpdate[];
	getFinalMessage(): ChatStreamMessage | undefined;
}

export type ParsedChatStreamSseEvent = Record<string, unknown> | { type: "done" };

export interface ParsedChatStreamSseBuffer {
	events: ParsedChatStreamSseEvent[];
	remainingBuffer: string;
}

interface PendingToolCall {
	id: string;
	name: string;
	parameters: Record<string, unknown>;
}

const streamEventSchema = z.record(z.string(), z.unknown());
const chatStreamCitationsSchema = z.array(z.string()).nullable();
const chatStreamToolCallSchema = z
	.object({
		id: z.string().optional(),
		function: z.object({
			name: z.string(),
			arguments: z.union([z.string(), streamEventSchema]),
		}),
		index: z.number().optional(),
	})
	.transform(
		(toolCall): ChatStreamToolCall => ({
			id: toolCall.id,
			type: "function",
			function: toolCall.function,
			index: toolCall.index,
		}),
	);

function defaultCreateId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return `msg_${Math.random().toString(36).slice(2)}`;
}

export function parseChatStreamSseEvent(block: string): ParsedChatStreamSseEvent | null {
	const dataLines = block
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice(5).trimStart());

	if (dataLines.length === 0) {
		return null;
	}

	const payload = dataLines.join("\n").trim();
	if (!payload) {
		return null;
	}

	if (payload === "[DONE]") {
		return { type: "done" };
	}

	let rawParsed: unknown;
	try {
		rawParsed = JSON.parse(payload);
	} catch {
		return null;
	}

	const parsed = streamEventSchema.safeParse(rawParsed);
	return parsed.success ? parsed.data : null;
}

export function parseChatStreamSseBuffer(
	buffer: string,
	options: { flush?: boolean } = {},
): ParsedChatStreamSseBuffer {
	const blocks = buffer.split(/\r?\n\r?\n/);
	const trailingBuffer = blocks.pop() || "";
	const completeBlocks =
		options.flush && trailingBuffer.trim() ? [...blocks, trailingBuffer] : blocks;
	const events = completeBlocks.flatMap((block): ParsedChatStreamSseEvent[] => {
		if (!block.trim()) {
			return [];
		}

		const event = parseChatStreamSseEvent(`${block}\n\n`);
		return event ? [event] : [];
	});

	return {
		events,
		remainingBuffer: options.flush ? "" : trailingBuffer,
	};
}

export function formatChatStreamSseEvent(
	type: string,
	payload: Record<string, unknown> = {},
): string {
	return `data: ${JSON.stringify({ ...payload, type })}\n\n`;
}

export function formatChatStreamSseDone(): string {
	return "data: [DONE]\n\n";
}

export function createChatStreamAssembler(
	options: ChatStreamAssemblerOptions = {},
): ChatStreamAssembler {
	return new ChatStreamAssemblerState(options);
}

class ChatStreamAssemblerState implements ChatStreamAssembler {
	private content = "";
	private messageData: unknown;
	private reasoning = "";
	private thinking = "";
	private streamedParts: MessagePart[] = [];
	private finalParts?: MessagePart[];
	private citations?: string[] | null;
	private usage: unknown;
	private id: string;
	private created?: number;
	private logId?: string;
	private toolCalls: ChatStreamToolCall[] = [];
	private responseProvider?: string;
	private responsePlatform?: string;
	private readonly pendingToolCalls: Record<string, PendingToolCall> = {};
	private readonly emittedToolResponseIds = new Set<string>();
	private responseModel?: string;
	private currentAssistantFinalised = false;
	private finalMessage?: ChatStreamMessage;
	private readonly createId: () => string;
	private readonly now: () => number;

	constructor(private readonly options: ChatStreamAssemblerOptions) {
		this.createId = options.createId ?? defaultCreateId;
		this.now = options.now ?? Date.now;
		this.responseModel = options.model;
		this.id = this.createId();
	}

	ingest(event: unknown): ChatStreamUpdate[] {
		const parsed = streamEventSchema.safeParse(event);
		if (!parsed.success) {
			return [];
		}

		return this.ingestEvent(parsed.data);
	}

	getFinalMessage(): ChatStreamMessage | undefined {
		return this.finalMessage;
	}

	private ingestEvent(event: Record<string, unknown>): ChatStreamUpdate[] {
		if (event.type === "done") {
			return this.ingestDone();
		}

		const contentDelta = this.contentDeltaFromProviderEvent(event);
		if (contentDelta) {
			return this.ingestContentDelta(contentDelta);
		}

		if (event.type === "message_stop") {
			return this.ingestMessageStop();
		}

		if (event.type === "message_start") {
			return this.ingestMessageStart(event);
		}

		if (event.type === "state" && typeof event.state === "string") {
			return [{ type: "state", state: event.state, event }];
		}

		if (event.type === "thinking_delta" && typeof event.thinking === "string") {
			return this.ingestThinkingDelta(event.thinking);
		}

		const thinkingDelta = this.thinkingDeltaFromProviderEvent(event);
		if (thinkingDelta) {
			return this.ingestThinkingDelta(thinkingDelta);
		}

		if (
			event.type === "tool_use_start" &&
			typeof event.tool_id === "string" &&
			typeof event.tool_name === "string"
		) {
			this.pendingToolCalls[event.tool_id] = {
				id: event.tool_id,
				name: event.tool_name,
				parameters: {},
			};
			return [];
		}

		if (event.type === "tool_use_delta" && typeof event.tool_id === "string") {
			const pendingToolCall = this.pendingToolCalls[event.tool_id];
			if (pendingToolCall) {
				pendingToolCall.parameters = {
					...pendingToolCall.parameters,
					...this.toolUseParametersFromEvent(event.parameters),
				};
			}
			return [];
		}

		if (event.type === "tool_use_stop" && typeof event.tool_id === "string") {
			return this.ingestToolUseStop(event.tool_id);
		}

		if (event.type === "tool_response") {
			return this.ingestToolResponse(event);
		}

		if (event.type === "tool_response_end") {
			if (this.currentAssistantFinalised) {
				this.resetAssistantState();
			}
			return [];
		}

		if (event.type === "message_delta") {
			return this.ingestMessageDelta(event);
		}

		return [];
	}

	private ingestDone(): ChatStreamUpdate[] {
		if (!this.currentAssistantFinalised && this.hasAssistantPayload()) {
			const message = this.finaliseAssistantMessage();
			return [
				{ type: "assistant_final", message },
				{ type: "done", message },
			];
		}

		return [{ type: "done", message: this.finalMessage }];
	}

	private ingestContentDelta(contentDelta: string): ChatStreamUpdate[] {
		if (this.currentAssistantFinalised) {
			this.resetAssistantState();
		}

		this.content += contentDelta;
		this.appendTextPart(contentDelta);
		return [{ type: "assistant_delta", content: this.content, reasoning: this.reasoning }];
	}

	private ingestMessageStop(): ChatStreamUpdate[] {
		if (this.currentAssistantFinalised || !this.hasAssistantPayload()) {
			return [];
		}

		return [{ type: "assistant_final", message: this.finaliseAssistantMessage() }];
	}

	private ingestThinkingDelta(thinkingDelta: string): ChatStreamUpdate[] {
		this.thinking += thinkingDelta;
		this.reasoning = this.thinking;
		this.appendReasoningPart(thinkingDelta);
		return [{ type: "assistant_delta", content: this.content, reasoning: this.reasoning }];
	}

	private ingestToolUseStop(toolId: string): ChatStreamUpdate[] {
		const pendingToolCall = this.pendingToolCalls[toolId];
		if (!pendingToolCall) {
			return [];
		}

		this.toolCalls.push({
			id: pendingToolCall.id,
			type: "function",
			function: {
				name: pendingToolCall.name,
				arguments: pendingToolCall.parameters,
			},
		});

		if (!this.currentAssistantFinalised) {
			this.streamedParts.push({
				type: "tool_use",
				name: pendingToolCall.name,
				toolCallId: pendingToolCall.id,
				input: pendingToolCall.parameters,
				timestamp: this.now(),
			});
		}

		delete this.pendingToolCalls[toolId];
		return [];
	}

	private ingestToolResponse(event: Record<string, unknown>): ChatStreamUpdate[] {
		const result = streamEventSchema.safeParse(event.result);
		if (!result.success) {
			return [];
		}

		const toolResponseId =
			typeof result.data.id === "string"
				? result.data.id
				: typeof event.tool_id === "string"
					? event.tool_id
					: this.createId();

		if (this.emittedToolResponseIds.has(toolResponseId)) {
			return [];
		}
		this.emittedToolResponseIds.add(toolResponseId);
		const parsedToolCallArguments = streamEventSchema.safeParse(result.data.tool_call_arguments);
		const toolCallArguments =
			typeof result.data.tool_call_arguments === "string"
				? result.data.tool_call_arguments
				: parsedToolCallArguments.success
					? parsedToolCallArguments.data
					: undefined;

		return [
			{
				type: "tool_result",
				message: {
					role: "tool",
					id: toolResponseId,
					content: typeof result.data.content === "string" ? result.data.content : "",
					name: typeof result.data.name === "string" ? result.data.name : undefined,
					status: typeof result.data.status === "string" ? result.data.status : null,
					data: result.data.data ?? null,
					created: this.now(),
					timestamp: typeof result.data.timestamp === "number" ? result.data.timestamp : undefined,
					log_id: typeof result.data.log_id === "string" ? result.data.log_id : undefined,
					model: typeof result.data.model === "string" ? result.data.model : undefined,
					platform: typeof result.data.platform === "string" ? result.data.platform : undefined,
					tool_call_id:
						typeof result.data.tool_call_id === "string" ? result.data.tool_call_id : undefined,
					tool_call_arguments: toolCallArguments,
					tool_calls: this.toolCallsFromEvent(result.data.tool_calls),
				},
			},
		];
	}

	private ingestMessageDelta(event: Record<string, unknown>): ChatStreamUpdate[] {
		if (typeof event.content === "string") {
			this.content = event.content;
			this.streamedParts = this.content
				? [
						{
							type: "text",
							text: this.content,
							timestamp: this.now(),
						},
					]
				: [];
		}

		if ("usage" in event) {
			this.usage = event.usage;
		}
		if (typeof event.log_id === "string") {
			this.logId = event.log_id;
		}

		const citations = chatStreamCitationsSchema.safeParse(event.citations);
		if (citations.success) {
			this.citations = citations.data;
		}

		if ("data" in event) {
			this.messageData = event.data;
		}
		if (typeof event.model === "string") {
			this.responseModel = event.model;
		}
		if (typeof event.provider === "string") {
			this.responseProvider = event.provider;
		}
		if (typeof event.platform === "string") {
			this.responsePlatform = event.platform;
		}

		const nextToolCalls = this.toolCallsFromEvent(event.tool_calls);
		if (nextToolCalls) {
			this.toolCalls = nextToolCalls;
		}

		const parts = this.messagePartsFromEvent(event.parts);
		if (parts) {
			this.finalParts = parts;
		}

		if (typeof event.message_id === "string") {
			this.id = event.message_id;
		}
		if (typeof event.created === "number") {
			this.created = event.created;
		}

		if (!this.hasAssistantPayload()) {
			return [];
		}

		const carriesFinalPayload =
			typeof event.content === "string" ||
			parts !== undefined ||
			nextToolCalls !== undefined ||
			event.finish_reason === "stop";

		return carriesFinalPayload
			? [{ type: "assistant_final", message: this.finaliseAssistantMessage(this.id) }]
			: [];
	}

	private ingestMessageStart(event: Record<string, unknown>): ChatStreamUpdate[] {
		const anthropicMessage = streamEventSchema.safeParse(event.message);

		if (typeof event.message_id === "string") {
			this.id = event.message_id;
		} else if (anthropicMessage.success && typeof anthropicMessage.data.id === "string") {
			this.id = anthropicMessage.data.id;
		}
		if (typeof event.created === "number") {
			this.created = event.created;
		}
		if (typeof event.model === "string") {
			this.responseModel = event.model;
		} else if (anthropicMessage.success && typeof anthropicMessage.data.model === "string") {
			this.responseModel = anthropicMessage.data.model;
		}
		if (typeof event.provider === "string") {
			this.responseProvider = event.provider;
		}
		if (typeof event.platform === "string") {
			this.responsePlatform = event.platform;
		}

		return [{ type: "assistant_metadata", message: this.buildAssistantMessage(this.id) }];
	}

	private resetAssistantState() {
		this.content = "";
		this.messageData = undefined;
		this.reasoning = "";
		this.thinking = "";
		this.streamedParts = [];
		this.finalParts = undefined;
		this.citations = undefined;
		this.usage = undefined;
		this.id = this.createId();
		this.created = undefined;
		this.logId = undefined;
		this.toolCalls = [];
		this.responseModel = this.options.model;
		this.responseProvider = undefined;
		this.responsePlatform = undefined;
		this.currentAssistantFinalised = false;
	}

	private buildAssistantMessage(messageId?: string): ChatStreamMessage {
		return {
			role: "assistant",
			content: this.content,
			parts:
				this.finalParts && this.finalParts.length > 0
					? this.finalParts
					: this.streamedParts.length > 0
						? this.streamedParts
						: undefined,
			data: this.messageData,
			reasoning: this.reasoning
				? {
						collapsed: false,
						content: this.reasoning,
					}
				: undefined,
			id: messageId || this.id,
			created: this.created,
			timestamp: this.created,
			model: this.responseModel,
			provider: this.responseProvider,
			platform: this.responsePlatform,
			citations: this.citations ?? null,
			usage: this.usage,
			tool_calls: this.toolCalls.length > 0 ? this.toolCalls : undefined,
			log_id: this.logId,
		};
	}

	private hasAssistantPayload(): boolean {
		return Boolean(
			this.content ||
			this.reasoning ||
			(this.finalParts && this.finalParts.length > 0) ||
			this.streamedParts.length > 0 ||
			this.toolCalls.length > 0,
		);
	}

	private finaliseAssistantMessage(messageId?: string): ChatStreamMessage {
		const message = this.buildAssistantMessage(messageId);
		this.finalMessage = message;
		this.currentAssistantFinalised = true;
		return message;
	}

	private appendTextPart(text: string) {
		if (!text) {
			return;
		}

		const lastPart = this.streamedParts[this.streamedParts.length - 1];
		if (lastPart?.type === "text") {
			lastPart.text += text;
			return;
		}

		this.streamedParts.push({
			type: "text",
			text,
			timestamp: this.now(),
		});
	}

	private appendReasoningPart(text: string) {
		if (!text) {
			return;
		}

		const lastPart = this.streamedParts[this.streamedParts.length - 1];
		if (lastPart?.type === "reasoning") {
			lastPart.text += text;
			return;
		}

		this.streamedParts.push({
			type: "reasoning",
			text,
			collapsed: true,
			timestamp: this.now(),
		});
	}

	private contentDeltaFromProviderEvent(event: Record<string, unknown>): string {
		if (event.type === "content_block_delta" && typeof event.content === "string") {
			return event.content;
		}

		if (event.type === "content_block_delta") {
			const delta = streamEventSchema.safeParse(event.delta);
			if (
				delta.success &&
				delta.data.type === "text_delta" &&
				typeof delta.data.text === "string"
			) {
				return delta.data.text;
			}
		}

		if (!Array.isArray(event.choices)) {
			return "";
		}

		const firstChoice = streamEventSchema.safeParse(event.choices[0]);
		if (!firstChoice.success) {
			return "";
		}

		const delta = streamEventSchema.safeParse(firstChoice.data.delta);
		return delta.success && typeof delta.data.content === "string" ? delta.data.content : "";
	}

	private thinkingDeltaFromProviderEvent(event: Record<string, unknown>): string {
		if (event.type !== "content_block_delta") {
			return "";
		}

		const delta = streamEventSchema.safeParse(event.delta);
		if (
			delta.success &&
			delta.data.type === "thinking_delta" &&
			typeof delta.data.thinking === "string"
		) {
			return delta.data.thinking;
		}

		return "";
	}

	private messagePartsFromEvent(parts: unknown): MessagePart[] | undefined {
		if (!Array.isArray(parts)) {
			return undefined;
		}

		const parsedParts = parts.flatMap((part): MessagePart[] => {
			const parsed = messagePartSchema.safeParse(part);
			return parsed.success ? [parsed.data] : [];
		});

		return parsedParts.length > 0 ? parsedParts : undefined;
	}

	private toolUseParametersFromEvent(parameters: unknown): Record<string, unknown> {
		const directParameters = streamEventSchema.safeParse(parameters);
		if (directParameters.success) {
			return directParameters.data;
		}

		if (typeof parameters !== "string") {
			return {};
		}

		try {
			const parsed = streamEventSchema.safeParse(JSON.parse(parameters));
			return parsed.success ? parsed.data : {};
		} catch {
			return {};
		}
	}

	private toolCallsFromEvent(value: unknown): ChatStreamToolCall[] | undefined {
		if (!Array.isArray(value)) {
			return undefined;
		}

		const toolCalls = value.flatMap((item): ChatStreamToolCall[] => {
			const parsed = chatStreamToolCallSchema.safeParse(item);
			return parsed.success ? [parsed.data] : [];
		});

		return toolCalls.length > 0 ? toolCalls : undefined;
	}
}
