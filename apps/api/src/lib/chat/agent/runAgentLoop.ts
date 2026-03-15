import {
	createToolCallActionHandler,
	executeAgentLoop,
	type AgentLoopState,
	type AgentMessage,
	type ToolCallInvocation,
} from "@assistant/agent-core";
import type { ConversationManager } from "~/lib/conversationManager";
import { getAIResponse } from "~/lib/chat/responses";
import { handleToolCalls } from "~/lib/chat/tools";
import type { IRequest, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const DEFAULT_AGENT_MAX_STEPS = 8;
const AGENT_MAX_RECOVERY_REPLANS = 2;
const AGENT_MAX_DECISION_FAILURES = 2;

const CHAT_ROLES = new Set([
	"user",
	"assistant",
	"tool",
	"developer",
	"system",
]);

interface ApiAgentLoopState extends AgentLoopState {
	commandCount: number;
}

interface ApiAgentSharedContext {
	completionId: string;
	conversationManager: ConversationManager;
	toolRequestContext: IRequest;
}

export interface ModelToolCall {
	id?: string;
	name?: string;
	arguments?: string;
	function?: {
		name?: string;
		arguments?: string;
	};
}

export interface ModelResponse {
	response?: string;
	tool_calls?: ModelToolCall[];
	citations?: string[] | null;
	data?: unknown;
	log_id?: string;
	usage?: Record<string, unknown>;
	usageMetadata?: Record<string, unknown>;
	status?: string;
	refusal?: string | null;
	annotations?: unknown;
}

export interface AgentLoopExecutionParams {
	requestParams: Parameters<typeof getAIResponse>[0];
	completionId: string;
	conversationManager: ConversationManager;
	toolRequestContext: IRequest;
	maxSteps?: number;
}

export interface AgentLoopExecutionResult {
	response: ModelResponse;
	toolResponses: Message[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessage(value: unknown): value is Message {
	if (!isRecord(value)) {
		return false;
	}

	if (!CHAT_ROLES.has(String(value.role))) {
		return false;
	}

	return "content" in value;
}

function normaliseInitialMessages(messages: unknown): Message[] {
	if (!Array.isArray(messages) || messages.length === 0) {
		throw new AssistantError(
			"Agent mode requires at least one message",
			ErrorType.PARAMS_ERROR,
		);
	}

	const normalised: Message[] = [];
	for (const message of messages) {
		if (!isMessage(message)) {
			throw new AssistantError(
				"Agent mode received invalid message format",
				ErrorType.PARAMS_ERROR,
			);
		}
		normalised.push(message);
	}

	return normalised;
}

function toProviderMessages(messages: AgentMessage[]): Message[] {
	return messages.map((message) => {
		const providerMessage: Message = {
			role: message.role,
			content: message.content,
		};

		if ("name" in message && typeof message.name === "string") {
			providerMessage.name = message.name;
		}

		if ("tool_call_id" in message && typeof message.tool_call_id === "string") {
			providerMessage.tool_call_id = message.tool_call_id;
		}

		if ("tool_call_arguments" in message) {
			const toolCallArguments = message.tool_call_arguments;
			if (
				typeof toolCallArguments === "string" ||
				isRecord(toolCallArguments)
			) {
				providerMessage.tool_call_arguments = toolCallArguments;
			}
		}

		if ("status" in message && typeof message.status === "string") {
			providerMessage.status = message.status;
		}

		return providerMessage;
	});
}

function isModelToolCall(value: unknown): value is ModelToolCall {
	if (!isRecord(value)) {
		return false;
	}

	if (
		"function" in value &&
		value.function !== undefined &&
		value.function !== null
	) {
		return isRecord(value.function);
	}

	return true;
}

function normaliseModelResponse(value: unknown): ModelResponse {
	if (!isRecord(value)) {
		throw new AssistantError(
			"Provider returned an invalid response shape",
			ErrorType.PROVIDER_ERROR,
		);
	}

	const toolCalls = Array.isArray(value.tool_calls)
		? value.tool_calls.filter(isModelToolCall)
		: undefined;

	const citations = Array.isArray(value.citations)
		? value.citations.filter(
				(citation): citation is string => typeof citation === "string",
			)
		: undefined;

	return {
		response: typeof value.response === "string" ? value.response : undefined,
		tool_calls: toolCalls,
		citations,
		data: value.data,
		log_id: typeof value.log_id === "string" ? value.log_id : undefined,
		usage: isRecord(value.usage) ? value.usage : undefined,
		usageMetadata: isRecord(value.usageMetadata)
			? value.usageMetadata
			: undefined,
		status: typeof value.status === "string" ? value.status : undefined,
		refusal:
			typeof value.refusal === "string"
				? value.refusal
				: value.refusal === null
					? null
					: undefined,
		annotations: value.annotations,
	};
}

function toToolCallInvocations(
	toolCalls: ModelToolCall[],
): ToolCallInvocation[] {
	return toolCalls.map((toolCall) => ({
		id: toolCall.id,
		name: toolCall.function?.name || toolCall.name || "unknown",
		arguments: toolCall.function?.arguments || toolCall.arguments,
		raw: toolCall,
	}));
}

function normaliseProviderToolCalls(
	toolCalls: ToolCallInvocation[],
): Record<string, unknown>[] {
	return toolCalls.map((toolCall) => {
		if (isRecord(toolCall.raw)) {
			return toolCall.raw;
		}

		return {
			id: toolCall.id || generateId(),
			type: "function",
			function: {
				name: toolCall.name,
				arguments:
					typeof toolCall.arguments === "string"
						? toolCall.arguments
						: JSON.stringify(toolCall.arguments || {}),
			},
		};
	});
}

export async function runAgentLoop(
	params: AgentLoopExecutionParams,
): Promise<AgentLoopExecutionResult> {
	const runtimeMessages = normaliseInitialMessages(
		params.requestParams.messages,
	);
	const state: ApiAgentLoopState = {
		commandCount: 0,
	};
	const toolResponses: Message[] = [];
	let finalResponse: ModelResponse | null = null;

	await executeAgentLoop<ApiAgentSharedContext, ApiAgentLoopState>({
		initialMessages: runtimeMessages,
		initialPlan: "Use available tools as needed, then return a final answer.",
		shared: {
			completionId: params.completionId,
			conversationManager: params.conversationManager,
			toolRequestContext: params.toolRequestContext,
		},
		state,
		config: {
			maxSteps: params.maxSteps || DEFAULT_AGENT_MAX_STEPS,
			maxConsecutiveDecisionFailures: AGENT_MAX_DECISION_FAILURES,
			maxRecoveryReplans: AGENT_MAX_RECOVERY_REPLANS,
		},
		getCommandCount: (runtimeState) => runtimeState.commandCount,
		resolveDecision: async ({ messages }) => {
			const providerResponse = await getAIResponse({
				...params.requestParams,
				messages: toProviderMessages(messages),
				stream: false,
			});

			if (providerResponse instanceof ReadableStream) {
				throw new AssistantError(
					"Agent mode expected non-streaming model response",
					ErrorType.PROVIDER_ERROR,
				);
			}

			const modelResponse = normaliseModelResponse(providerResponse);
			if (!modelResponse.response && !modelResponse.tool_calls?.length) {
				throw new AssistantError(
					"No response generated by the model",
					ErrorType.PARAMS_ERROR,
				);
			}

			if (modelResponse.tool_calls?.length) {
				const toolCalls = toToolCallInvocations(modelResponse.tool_calls);
				return {
					decision: {
						action: "tool_calls",
						toolCalls,
						responseText:
							typeof modelResponse.response === "string"
								? modelResponse.response
								: "",
					},
					assistantMessage: {
						role: "assistant",
						content: modelResponse.response || "",
						tool_calls: modelResponse.tool_calls,
					},
				};
			}

			finalResponse = modelResponse;
			return {
				decision: {
					action: "finish",
					summary:
						typeof modelResponse.response === "string"
							? modelResponse.response
							: JSON.stringify(modelResponse.response ?? ""),
				},
				assistantMessage: {
					role: "assistant",
					content: modelResponse.response || "",
				},
			};
		},
		handlers: [
			createToolCallActionHandler<ApiAgentSharedContext, ApiAgentLoopState>({
				onToolCalls: async (decision, context) => {
					const providerToolCalls = normaliseProviderToolCalls(
						decision.toolCalls,
					);
					const toolResults = await handleToolCalls(
						context.shared.completionId,
						{
							response: decision.responseText || "",
							tool_calls: providerToolCalls,
						},
						context.shared.conversationManager,
						context.shared.toolRequestContext,
					);

					context.state.commandCount += providerToolCalls.length;
					toolResponses.push(...toolResults);
					context.messages.push(...toolResults);
				},
			}),
		],
	});

	if (!finalResponse) {
		throw new AssistantError(
			"Agent loop finished without a final response",
			ErrorType.PROVIDER_ERROR,
		);
	}

	return {
		response: finalResponse,
		toolResponses,
	};
}
