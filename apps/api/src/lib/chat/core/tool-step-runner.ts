import type { ConversationManager } from "~/lib/conversationManager";
import { getAIResponse } from "~/lib/chat/responses";
import { handleToolCalls } from "~/lib/chat/tools";
import { shouldContinueAfterToolResults } from "~/lib/chat/tool-results";
import type { ChatCompletionParameters, IRequest, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type ToolStepToolCall = {
	id?: string;
	type?: string;
	name?: string;
	function?: {
		name?: string;
		arguments?: string;
	};
};

type ToolStepResponse = {
	response?: string;
	tool_calls?: ToolStepToolCall[];
	citations?: string[] | null;
	data?: unknown;
	log_id?: string;
	usage?: Record<string, unknown>;
	usageMetadata?: Record<string, unknown>;
	status?: string;
};

type ToolStepUsage = Record<string, unknown>;

export interface NonStreamingToolStepSummary {
	stepNumber: number;
	stepType: "tool-call" | "final";
	toolCallCount: number;
	toolResultCount: number;
	usage?: ToolStepUsage;
}

export interface NonStreamingToolStepMetadata {
	steps?: NonStreamingToolStepSummary[];
	totalUsage?: ToolStepUsage;
}

export interface ToolStepRunnerResult<Response extends ToolStepResponse> {
	response: Response & NonStreamingToolStepMetadata;
	toolResponses: Message[];
	responseAlreadyStored: boolean;
	steps: NonStreamingToolStepSummary[];
	totalUsage?: ToolStepUsage;
}

export interface RunNonStreamingToolStepsParams<Response extends ToolStepResponse> {
	response: Response;
	requestParams: ChatCompletionParameters;
	completionId: string;
	conversationManager: ConversationManager;
	toolRequestContext: IRequest;
	maxSteps?: number;
	buildAssistantMessage: (response: Response) => Message;
}

function getToolCalls(response: ToolStepResponse): ToolStepToolCall[] {
	return Array.isArray(response.tool_calls) ? response.tool_calls : [];
}

function getUsage(response: ToolStepResponse): ToolStepUsage | undefined {
	return response.usage || response.usageMetadata;
}

function addUsage(
	totalUsage: ToolStepUsage | undefined,
	stepUsage: ToolStepUsage | undefined,
): ToolStepUsage | undefined {
	if (!stepUsage) {
		return totalUsage;
	}

	const nextUsage: ToolStepUsage = totalUsage ? { ...totalUsage } : {};
	for (const [key, value] of Object.entries(stepUsage)) {
		if (typeof value === "number") {
			const existing = nextUsage[key];
			nextUsage[key] = typeof existing === "number" ? existing + value : value;
			continue;
		}

		if (!(key in nextUsage)) {
			nextUsage[key] = value;
		}
	}

	return nextUsage;
}

function withStepMetadata<Response extends ToolStepResponse>(
	response: Response,
	steps: NonStreamingToolStepSummary[],
	totalUsage: ToolStepUsage | undefined,
): Response & NonStreamingToolStepMetadata {
	if (steps.length === 0) {
		return response;
	}

	return {
		...response,
		steps,
		...(totalUsage ? { totalUsage, usage: totalUsage } : {}),
	};
}

export async function runNonStreamingToolSteps<Response extends ToolStepResponse>(
	params: RunNonStreamingToolStepsParams<Response>,
): Promise<ToolStepRunnerResult<Response>> {
	let response = params.response;
	let currentStep = params.requestParams.current_step ?? 1;
	let responseAlreadyStored = false;
	const toolResponses: Message[] = [];
	const steps: NonStreamingToolStepSummary[] = [];
	let totalUsage: ToolStepUsage | undefined;
	const messages = Array.isArray(params.requestParams.messages)
		? [...params.requestParams.messages]
		: [];

	while (getToolCalls(response).length > 0) {
		const toolCalls = getToolCalls(response);
		const assistantMessage = params.buildAssistantMessage(response);
		const stepUsage = getUsage(response);

		await params.conversationManager.add(params.completionId, assistantMessage);
		responseAlreadyStored = true;

		const stepToolResponses = await handleToolCalls(
			params.completionId,
			response,
			params.conversationManager,
			params.toolRequestContext,
		);
		toolResponses.push(...stepToolResponses);
		messages.push(assistantMessage, ...stepToolResponses);
		totalUsage = addUsage(totalUsage, stepUsage);
		steps.push({
			stepNumber: currentStep,
			stepType: "tool-call",
			toolCallCount: toolCalls.length,
			toolResultCount: stepToolResponses.length,
			usage: stepUsage,
		});

		const canContinue =
			typeof params.maxSteps === "number" &&
			currentStep < params.maxSteps &&
			shouldContinueAfterToolResults(toolCalls, stepToolResponses);

		if (!canContinue) {
			return {
				response: withStepMetadata(response, steps, totalUsage),
				toolResponses,
				responseAlreadyStored,
				steps,
				totalUsage,
			};
		}

		currentStep += 1;
		const nextResponse = await getAIResponse({
			...params.requestParams,
			current_step: currentStep,
			messages,
			stream: false,
		});

		if (nextResponse instanceof ReadableStream) {
			throw new AssistantError(
				"Non-streaming tool step expected non-streaming model response",
				ErrorType.PROVIDER_ERROR,
			);
		}

		response = nextResponse;
		responseAlreadyStored = false;
	}
	const finalStepUsage = getUsage(response);
	totalUsage = addUsage(totalUsage, finalStepUsage);
	if (steps.length > 0) {
		steps.push({
			stepNumber: currentStep,
			stepType: "final",
			toolCallCount: 0,
			toolResultCount: 0,
			usage: finalStepUsage,
		});
	}

	return {
		response: withStepMetadata(response, steps, totalUsage),
		toolResponses,
		responseAlreadyStored,
		steps,
		totalUsage,
	};
}
