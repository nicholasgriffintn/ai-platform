import { AssistantError, ErrorType } from "~/utils/errors";
import { handleFunctions } from "../../services/functions";
import type { IRequest, Message } from "../../types";
import {
	formatToolErrorResponse,
	formatToolResponse,
} from "../../utils/tool-responses";
import type { ConversationManager } from "../conversationManager";

interface ToolCallError extends Error {
	functionName?: string;
}

export const handleToolCalls = async (
	completion_id: string,
	modelResponse: any,
	conversationManager: ConversationManager,
	req: IRequest,
	isRestricted: boolean,
): Promise<Message[]> => {
	if (isRestricted) {
		throw new AssistantError(
			"Tool usage requires authentication. Please provide a valid access token.",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const functionResults: Message[] = [];
	const modelResponseLogId = req.env.AI.aiGatewayLogId;
	const timestamp = Date.now();

	const toolCalls = modelResponse.tool_calls || [];

	const toolMessage = await conversationManager.add(completion_id, {
		role: "assistant",
		name: "External Functions",
		tool_calls: toolCalls,
		log_id: modelResponseLogId || "",
		content: "",
		id: Math.random().toString(36).substring(2, 7),
		timestamp,
		model: req.request?.model,
		platform: req.request?.platform || "api",
	});
	functionResults.push(toolMessage);

	for (const toolCall of toolCalls) {
		try {
			const functionName = toolCall.function?.name || toolCall.name;
			if (!functionName) {
				throw new Error("Invalid tool call: missing function name");
			}

			const rawArgs = toolCall.function?.arguments || toolCall.arguments;
			const functionArgs =
				typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;

			const result = await handleFunctions({
				completion_id,
				app_url: req.app_url,
				functionName,
				args: functionArgs,
				request: req,
			});

			if (!result) {
				return;
			}

			const formattedResponse = formatToolResponse(
				functionName,
				result.content || "",
				result.data,
			);

			const message = await conversationManager.add(completion_id, {
				role: "tool",
				name: functionName,
				content: formattedResponse.content,
				status: result.status,
				data: formattedResponse.data,
				log_id: modelResponseLogId || "",
				id: Math.random().toString(36).substring(2, 7),
				timestamp: Date.now(),
				model: req.request?.model,
				platform: req.request?.platform || "api",
			});

			functionResults.push(message);
		} catch (error) {
			const functionError = error as ToolCallError;
			console.error(
				`Tool call error for ${functionError.functionName}:`,
				error,
			);

			const functionName =
				functionError.functionName ||
				toolCall.function?.name ||
				toolCall.name ||
				"unknown";
			const formattedError = formatToolErrorResponse(
				functionName,
				functionError.message,
			);

			functionResults.push({
				role: "tool",
				name: toolCall.name,
				content: formattedError.content,
				status: "error",
				data: formattedError.data,
				log_id: modelResponseLogId || "",
				id: Math.random().toString(36).substring(2, 7),
				timestamp: Date.now(),
				model: req.request?.model,
				platform: req.request?.platform || "api",
			});
		}
	}

	return functionResults;
};
