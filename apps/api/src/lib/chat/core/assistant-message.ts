import { buildAssistantMessageData } from "~/lib/chat/mode-metadata";
import type { ChatMode, ChatRequestOptions, Message, Platform } from "~/types";
import { generateId } from "~/utils/id";
import { nonEmptyToolCallsOrNull } from "~/utils/toolCalls";

type AssistantResponseForStorage = {
	response?: string;
	citations?: string[] | null;
	data?: unknown;
	log_id?: string;
	usage?: Record<string, unknown>;
	usageMetadata?: Record<string, unknown>;
	tool_calls?: unknown;
	status?: string;
};

export interface BuildStoredAssistantMessageParams {
	response: AssistantResponseForStorage;
	content: string;
	envLogId?: string;
	mode: ChatMode;
	model: string;
	platform: Platform;
	requestOptions?: ChatRequestOptions;
	councilRouting?: Parameters<typeof buildAssistantMessageData>[0]["councilRouting"];
}

export function buildStoredAssistantMessage(params: BuildStoredAssistantMessageParams): Message {
	return {
		role: "assistant",
		content: params.content,
		citations: params.response.citations || null,
		data: buildAssistantMessageData({
			responseData: params.response.data,
			requestOptions: params.requestOptions,
			councilRouting: params.councilRouting,
		}),
		log_id: params.envLogId || params.response.log_id,
		mode: params.mode,
		id: generateId(),
		timestamp: Date.now(),
		model: params.model,
		platform: params.platform,
		usage: params.response.usage || params.response.usageMetadata,
		tool_calls: nonEmptyToolCallsOrNull(params.response.tool_calls),
		status: params.response.status || undefined,
	};
}
