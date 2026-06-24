import type { AgentEvent } from "@assistant/agent-core";
import { buildStoredAssistantMessage } from "~/lib/chat/core/assistant-message";
import { runAgentLoop } from "~/lib/chat/agent/runAgentLoop";
import type { ConversationManager } from "~/lib/conversationManager";
import type {
	ChatCompletionParameters,
	ChatMode,
	ChatRequestOptions,
	IRequest,
	Message,
	Platform,
} from "~/types";
import { createChatSseStreamWriter } from "~/lib/chat/emitter";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/core/agent-stream" });

export interface CreateAgentExecutionStreamParams {
	requestParams: ChatCompletionParameters;
	completionId: string;
	conversationManager: ConversationManager;
	toolRequestContext: IRequest;
	maxSteps?: number;
	envLogId?: string;
	mode: ChatMode;
	model: string;
	platform: Platform;
	requestOptions?: ChatRequestOptions;
}

function serialiseAgentEvent(event: AgentEvent): Record<string, unknown> {
	return {
		...event,
	};
}

function buildFinalMessage(
	params: CreateAgentExecutionStreamParams,
	response: {
		response?: string;
		citations?: string[] | null;
		data?: unknown;
		log_id?: string;
		usage?: Record<string, unknown>;
		usageMetadata?: Record<string, unknown>;
		tool_calls?: unknown;
		status?: string;
	},
): Message {
	return buildStoredAssistantMessage({
		response,
		content: response.response || "",
		envLogId: params.envLogId,
		mode: params.mode,
		model: params.model,
		platform: params.platform,
		requestOptions: params.requestOptions,
	});
}

export function createAgentExecutionStream(
	params: CreateAgentExecutionStreamParams,
): ReadableStream {
	const stream = createChatSseStreamWriter();

	const run = async () => {
		try {
			await stream.writeEvent("state", {
				state: "agent_event",
				event: {
					type: "agent_stream_started",
				},
			});

			const agentResult = await runAgentLoop({
				requestParams: params.requestParams,
				completionId: params.completionId,
				conversationManager: params.conversationManager,
				toolRequestContext: params.toolRequestContext,
				maxSteps: params.maxSteps,
				emit: async (event) => {
					await stream.writeEvent("state", {
						state: "agent_event",
						event: serialiseAgentEvent(event),
					});
				},
			});

			const finalMessage = buildFinalMessage(params, agentResult.response);
			await params.conversationManager.add(params.completionId, finalMessage);

			if (
				typeof agentResult.response.response === "string" &&
				agentResult.response.response.length > 0
			) {
				await stream.writeEvent("content_block_delta", {
					content: agentResult.response.response,
				});
			}

			await stream.writeEvent("message_delta", {
				id: params.completionId,
				message_id: finalMessage.id,
				object: "chat.completion",
				created: finalMessage.timestamp,
				model: params.model,
				log_id: finalMessage.log_id,
				usage: finalMessage.usage,
				citations: finalMessage.citations,
				tool_calls: finalMessage.tool_calls,
				data: finalMessage.data,
				parts: finalMessage.parts,
				finish_reason: "stop",
			});
			await stream.writeEvent("message_stop", {});
			await stream.writeDone();
			await stream.close();
		} catch (error) {
			logger.error("Agent stream failed", { error, completionId: params.completionId });
			const message = error instanceof Error ? error.message : "Agent stream failed";
			await stream.writeEvent("error", {
				error: message,
				type: error instanceof AssistantError ? error.type : ErrorType.PROVIDER_ERROR,
			});
			await stream.writeDone();
			await stream.close();
		}
	};

	void run().catch((error) => {
		logger.error("Agent stream runner crashed", { error, completionId: params.completionId });
		void stream.abort(error);
	});

	return stream.readable;
}
