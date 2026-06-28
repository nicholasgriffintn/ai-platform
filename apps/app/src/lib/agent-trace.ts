import type { Message, MessageUsage } from "~/types";

export type AgentTraceEntryType =
	| "user_turn"
	| "model_call"
	| "assistant_response"
	| "tool_call"
	| "tool_result"
	| "approval"
	| "retry"
	| "provider_error";

export interface AgentTraceUsage {
	costUsd?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
}

export interface AgentTraceEntry {
	id: string;
	type: AgentTraceEntryType;
	label: string;
	status?: string;
	provider?: string;
	model?: string;
	latencyMs?: number;
	usage?: AgentTraceUsage;
	detail?: string;
}

function truncateTraceText(value: string, maxLength = 96): string {
	return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

function readMessageTime(message: Message | undefined): number | undefined {
	return typeof message?.created === "number"
		? message.created
		: typeof message?.timestamp === "number"
			? message.timestamp
			: undefined;
}

function readUsage(usage: MessageUsage | undefined): AgentTraceUsage | undefined {
	if (!usage) {
		return undefined;
	}

	const inputTokens = usage.prompt_tokens ?? usage.promptTokenCount;
	const outputTokens = usage.completion_tokens ?? usage.candidatesTokenCount;
	const totalTokens = usage.total_tokens ?? usage.totalTokenCount;
	const costUsd =
		usage.cost_usd ?? usage.costUsd ?? usage.estimated_cost_usd ?? usage.estimatedCostUsd;

	if (
		inputTokens === undefined &&
		outputTokens === undefined &&
		totalTokens === undefined &&
		costUsd === undefined
	) {
		return undefined;
	}

	return {
		costUsd,
		inputTokens,
		outputTokens,
		totalTokens,
	};
}

function readTextContent(message: Message): string {
	if (typeof message.content === "string") {
		return message.content.trim();
	}

	if (!Array.isArray(message.content)) {
		return "";
	}

	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.filter(Boolean)
		.join("\n")
		.trim();
}

function readDataRecord(message: Message): Record<string, unknown> | undefined {
	return message.data && typeof message.data === "object"
		? (message.data as Record<string, unknown>)
		: undefined;
}

function readProviderError(message: Message): string | undefined {
	const data = readDataRecord(message);
	const error = data?.error;
	return typeof error === "string" && error.trim() ? error : undefined;
}

function readRetryDetail(message: Message): string | undefined {
	const data = readDataRecord(message);
	if (!data) {
		return undefined;
	}

	if (typeof data.retryAttempt === "number") {
		return `Attempt ${data.retryAttempt.toLocaleString()}`;
	}

	if (typeof data.retryOf === "string" && data.retryOf.trim()) {
		return `Retry of ${data.retryOf}`;
	}

	const retry = data.retry;
	if (typeof retry === "number") {
		return `Attempt ${retry.toLocaleString()}`;
	}

	if (typeof retry === "string" && retry.trim()) {
		return retry;
	}

	if (retry && typeof retry === "object") {
		const attempt = (retry as { attempt?: unknown }).attempt;
		if (typeof attempt === "number") {
			return `Attempt ${attempt.toLocaleString()}`;
		}
		return "Retry";
	}

	return undefined;
}

function hasApprovalRequest(message: Message): boolean {
	const data = readDataRecord(message);
	if (data?.approvalRequired === true) {
		return true;
	}

	const humanInTheLoop = data?.humanInTheLoop;
	return (
		typeof humanInTheLoop === "object" &&
		humanInTheLoop !== null &&
		"type" in humanInTheLoop &&
		(humanInTheLoop as { type?: unknown }).type === "approval"
	);
}

function getLatencyMs(previous: Message | undefined, current: Message): number | undefined {
	const start = readMessageTime(previous);
	const end = readMessageTime(current);
	if (start === undefined || end === undefined || end < start) {
		return undefined;
	}

	return end - start;
}

export function buildAgentTraceEntries(messages: readonly Message[]): AgentTraceEntry[] {
	const entries: AgentTraceEntry[] = [];

	for (const [index, message] of messages.entries()) {
		const previous = messages[index - 1];
		const textContent = readTextContent(message);
		const tracedToolCallIds = new Set<string>();

		if (message.role === "user" && textContent) {
			entries.push({
				id: `user:${message.id}`,
				type: "user_turn",
				label: truncateTraceText(textContent),
			});
		}

		if (message.role === "assistant" && message.model) {
			entries.push({
				id: `model:${previous?.id ?? "start"}:${message.id}`,
				type: "model_call",
				label: message.model,
				model: message.model,
				provider: message.platform,
				latencyMs: getLatencyMs(previous, message),
				usage: readUsage(message.usage),
			});
		}

		if (message.role === "assistant" && textContent) {
			entries.push({
				id: `assistant-response:${message.id}`,
				type: "assistant_response",
				label: truncateTraceText(textContent),
				model: message.model,
				provider: message.platform,
				usage: readUsage(message.usage),
			});
		}

		for (const toolCall of message.tool_calls ?? []) {
			const toolCallId = toolCall.id ?? `${message.id}:${toolCall.function.name}`;
			if (tracedToolCallIds.has(toolCallId)) {
				continue;
			}
			tracedToolCallIds.add(toolCallId);
			entries.push({
				id: `tool-call:${message.id}:${toolCallId}`,
				type: "tool_call",
				label: toolCall.function.name,
				detail:
					typeof toolCall.function.arguments === "string"
						? toolCall.function.arguments
						: JSON.stringify(toolCall.function.arguments),
			});
		}

		for (const part of message.parts ?? []) {
			if (part.type === "tool_use") {
				const toolCallId = part.toolCallId ?? part.id ?? `${message.id}:${part.name}`;
				if (tracedToolCallIds.has(toolCallId)) {
					continue;
				}
				tracedToolCallIds.add(toolCallId);
				entries.push({
					id: `tool-call:${message.id}:${toolCallId}`,
					type: "tool_call",
					label: part.name,
					detail: typeof part.input === "string" ? part.input : JSON.stringify(part.input),
				});
			}

			if (part.type === "tool_result") {
				entries.push({
					id: `tool-result:${message.id}:${part.toolCallId ?? part.id ?? part.name ?? "tool"}`,
					type: "tool_result",
					label: part.name ?? "Tool result",
					status: part.status,
					detail: typeof part.content === "string" ? part.content : JSON.stringify(part.content),
				});
			}
		}

		if (message.role === "tool") {
			entries.push({
				id: `tool-result:${message.id}`,
				type: "tool_result",
				label: message.name ?? "Tool result",
				status: message.status,
				detail: textContent,
			});

			if (hasApprovalRequest(message)) {
				entries.push({
					id: `approval:${message.id}`,
					type: "approval",
					label: message.name ?? "Tool approval",
					status: "pending",
				});
			}
		}

		const retryDetail = readRetryDetail(message);
		if (retryDetail) {
			entries.push({
				id: `retry:${message.id}`,
				type: "retry",
				label: retryDetail,
				provider: message.platform,
				model: message.model,
			});
		}

		const providerError = readProviderError(message);
		if (providerError) {
			entries.push({
				id: `provider-error:${message.id}`,
				type: "provider_error",
				label: providerError,
			});
		}
	}

	return entries;
}
