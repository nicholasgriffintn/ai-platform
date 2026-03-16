import type { ConversationManager } from "~/lib/conversationManager";
import { PermissionChecker } from "~/lib/permissions/PermissionChecker";
import { handleFunctions } from "~/services/functions";
import type { IRequest, Message } from "~/types";
import { generateId } from "~/utils/id";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
	formatToolErrorResponse,
	formatToolResponse,
} from "~/utils/tool-responses";
import { safeParseJson } from "~/utils/json";
import { buildMessageParts } from "./messageParts";
import z from "zod/v4";

const logger = getLogger({ prefix: "lib/chat/tools" });
const permissionChecker = new PermissionChecker();

interface ToolCallError extends Error {
	functionName?: string;
	type?: string;
	status?: number;
}

export const handleToolCalls = async (
	completion_id: string,
	modelResponse: any,
	conversationManager: ConversationManager,
	req: IRequest,
): Promise<Message[]> => {
	const withDerivedParts = (message: Message): Message => ({
		...message,
		parts: message.parts || buildMessageParts(message),
	});

	const functionResults: Message[] = [];
	const modelResponseLogId = req.env.AI.aiGatewayLogId;
	const timestamp = Date.now();

	const toolCalls = modelResponse.tool_calls || [];
	if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
		return [];
	}

	const mode = req.mode || req.request?.mode;
	const approvedTools = new Set(req.request?.approved_tools ?? []);
	const toolPermissionsMap = req.request?.tool_permissions_map ?? {};

	for (const toolCall of toolCalls) {
		const functionName = toolCall.function?.name || toolCall.name || "unknown";
		logger.info(`Tool call: ${functionName}`);

		try {
			if (!toolCall.id) {
				throw new AssistantError(
					"Missing tool call ID",
					ErrorType.TOOL_CALL_ERROR,
				);
			}

			const permissionResult = permissionChecker.checkToolAccess({
				toolName: functionName,
				mode,
				user: req.user,
				toolPermissions: toolPermissionsMap[functionName],
			});

			if (!permissionResult.allowed) {
				logger.warn(`Tool "${functionName}" blocked by permission check`, {
					reason: permissionResult.reason,
					mode,
				});
				const blockedError = formatToolErrorResponse(
					functionName,
					permissionResult.reason ??
						`Tool "${functionName}" is not permitted in ${permissionResult.mode} mode`,
					"PERMISSION_DENIED",
				);
				functionResults.push(
					withDerivedParts({
						role: "tool",
						name: functionName,
						content: blockedError.content,
						status: "error",
						data: blockedError.data,
						log_id: modelResponseLogId || "",
						id: generateId(),
						tool_call_id: toolCall.id,
						tool_call_arguments:
							toolCall.arguments || toolCall.function?.arguments,
						timestamp,
						model: req.request?.model || "unknown",
						platform: req.request?.platform || "api",
					}),
				);
				continue;
			}

			if (
				permissionResult.requiresApproval &&
				!approvedTools.has(functionName)
			) {
				logger.warn(
					`Tool "${functionName}" requires approval but was not pre-approved`,
					{
						mode,
					},
				);
				const approvalError = formatToolErrorResponse(
					functionName,
					permissionResult.reason ??
						`Tool "${functionName}" requires explicit approval before it can run. Ask the user to confirm.`,
					"APPROVAL_REQUIRED",
				);
				functionResults.push(
					withDerivedParts({
						role: "tool",
						name: functionName,
						content: approvalError.content,
						status: "error",
						data: approvalError.data,
						log_id: modelResponseLogId || "",
						id: generateId(),
						tool_call_id: toolCall.id,
						tool_call_arguments:
							toolCall.arguments || toolCall.function?.arguments,
						timestamp,
						model: req.request?.model || "unknown",
						platform: req.request?.platform || "api",
					}),
				);
				continue;
			}

			if (functionName === "memory") {
				const rawArgs =
					toolCall.function?.arguments || toolCall.arguments || "{}";
				const memoryArgs = safeParseJson(rawArgs);
				if (!memoryArgs) {
					logger.error(`Failed to parse memory arguments: ${rawArgs}`);
					throw new AssistantError(
						`Invalid memory tool arguments: ${rawArgs}`,
						ErrorType.TOOL_CALL_ERROR,
					);
				}

				const memMessage: Message = {
					role: "tool",
					name: "memory",
					content:
						memoryArgs.type === "store"
							? `📝 Stored ${memoryArgs.category} memory: ${memoryArgs.text}`
							: "🔍 Created memory snapshot",
					status: "success",
					data: {
						type: memoryArgs.type,
						category: memoryArgs.category,
						text: memoryArgs.text,
					},
					log_id: modelResponseLogId || "",
					id: generateId(),
					tool_call_id: toolCall.id,
					tool_call_arguments:
						toolCall.arguments || toolCall.function?.arguments,
					timestamp,
					model: req.request?.model || "unknown",
					platform: req.request?.platform || "api",
				};
				functionResults.push(withDerivedParts(memMessage));
				continue;
			}

			const rawArgs = toolCall.function?.arguments || toolCall.arguments;
			const functionArgs = safeParseJson(rawArgs);
			if (!functionArgs) {
				logger.error(
					`Failed to parse arguments for ${functionName}: ${rawArgs}`,
				);
				throw new AssistantError(
					`Invalid arguments for ${functionName}: ${rawArgs}`,
					ErrorType.TOOL_CALL_ERROR,
				);
			}

			if (!functionArgs || typeof functionArgs !== "object") {
				throw new AssistantError(
					`Invalid arguments format for ${functionName}: expected object`,
					ErrorType.TOOL_CALL_ERROR,
				);
			}

			let result: any;
			try {
				result = await handleFunctions({
					completion_id,
					app_url: req.app_url,
					functionName,
					args: functionArgs,
					request: req,
					conversationManager,
				});
			} catch (functionError: any) {
				logger.error(
					`Function execution error for ${functionName}:`,
					functionError,
				);
				const errorType = functionError.type || "FUNCTION_EXECUTION_ERROR";
				const formattedError = formatToolErrorResponse(
					functionName,
					functionError.message || "Function execution failed",
					errorType,
				);

				const errorMessage: Message = {
					role: "tool",
					name: functionName,
					content: formattedError.content,
					status: "error",
					data: formattedError.data,
					log_id: modelResponseLogId || "",
					id: generateId(),
					tool_call_id: toolCall.id,
					tool_call_arguments:
						toolCall.arguments || toolCall.function?.arguments,
					timestamp,
					model: req.request?.model || "unknown",
					platform: req.request?.platform || "api",
				};

				functionResults.push(withDerivedParts(errorMessage));
				continue;
			}

			if (!result) {
				logger.warn(`No result returned for tool call ${functionName}`);
				const nullResultError = formatToolErrorResponse(
					functionName,
					"Tool returned no result",
					"EMPTY_RESULT",
				);

				functionResults.push(
					withDerivedParts({
						role: "tool",
						name: functionName,
						content: nullResultError.content,
						status: "error",
						data: nullResultError.data,
						log_id: modelResponseLogId || "",
						id: generateId(),
						tool_call_id: toolCall.id,
						tool_call_arguments:
							toolCall.arguments || toolCall.function?.arguments,
						timestamp,
						model: req.request?.model || "unknown",
						platform: req.request?.platform || "api",
					}),
				);
				continue;
			}

			const formattedResponse = formatToolResponse(
				functionName,
				result.content || "",
				result.data,
			);

			const message: Message = {
				role: "tool",
				name: functionName,
				content: formattedResponse.content,
				status: result.status || "success",
				data: formattedResponse.data,
				log_id: modelResponseLogId || "",
				id: generateId(),
				tool_call_id: toolCall.id,
				tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
				timestamp,
				model: req.request?.model || "unknown",
				platform: req.request?.platform || "api",
			};

			functionResults.push(withDerivedParts(message));
		} catch (error) {
			const functionError = error as ToolCallError;
			const errorType = functionError.type || "TOOL_CALL_ERROR";

			logger.error(`Tool call error for ${functionName}:`, {
				error,
				type: errorType,
				status: functionError.status,
			});

			const formattedError = formatToolErrorResponse(
				functionName,
				functionError.message || "Unknown error occurred",
				errorType,
			);

			const errorMessage: Message = {
				role: "tool",
				name: toolCall.name || functionName,
				content: formattedError.content,
				status: "error",
				data: formattedError.data,
				log_id: modelResponseLogId || "",
				id: generateId(),
				tool_call_id: toolCall.id,
				tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
				timestamp,
				model: req.request?.model || "unknown",
				platform: req.request?.platform || "api",
			};

			functionResults.push(withDerivedParts(errorMessage));
		}
	}

	if (functionResults.length > 0) {
		try {
			await conversationManager.addBatch(completion_id, functionResults);
		} catch (error) {
			logger.error("Failed to store tool call results:", {
				error,
				completion_id,
			});
		}
	}

	return functionResults;
};

export function formatToolCalls(provider: string, functions: any[]) {
	if (!functions || !Array.isArray(functions)) {
		logger.warn("Invalid functions provided to formatToolCalls");
		return [];
	}

	if (provider === "bedrock") {
		return functions
			.map((func) => {
				const parameters = resolveFunctionParameters(func);
				if (!parameters) {
					logger.warn(`Missing parameters for function ${func.name}`);
					return null;
				}

				return {
					toolSpec: {
						name: func.name,
						description: func.description,
						inputSchema: {
							json: parameters,
						},
					},
				};
			})
			.filter(Boolean);
	}

	if (provider === "anthropic") {
		return functions
			.map((func) => {
				const parameters = resolveFunctionParameters(func);
				if (!parameters) {
					logger.warn(`Missing parameters for function ${func.name}`);
					return null;
				}

				return {
					name: func.name,
					description: func.description,
					input_schema: parameters,
				};
			})
			.filter(Boolean);
	}

	return functions
		.map((func) => {
			const parameters = resolveFunctionParameters(func);

			if (!parameters) {
				logger.warn(`Missing parameters for function ${func.name}`);
				return null;
			}

			return {
				type: "function",
				function: {
					name: func.name,
					description: func.description,
					parameters,
				},
			};
		})
		.filter(Boolean);
}

function resolveFunctionParameters(func: any): Record<string, unknown> | null {
	if (func.parameters) {
		return func.parameters?.jsonSchema || func.parameters;
	}

	if (!func.inputSchema) {
		return null;
	}

	try {
		return z.toJSONSchema(func.inputSchema);
	} catch (error) {
		logger.warn("Failed to convert tool input schema to JSON schema", {
			name: func.name,
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		return null;
	}
}
