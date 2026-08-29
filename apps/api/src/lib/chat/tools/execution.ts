import {
  defineTool,
  flattenObjectRootSchema,
  isToolDefinition,
  toProviderToolDefinitions,
  type ProviderToolDefinition,
  type ToolDefinition,
} from "@ngriffin_uk/polychat-library-tool-runtime";
import z from "zod/v4";

import { buildMessageParts } from "~/lib/chat/messages/parts";
import type { ConversationManager } from "~/lib/conversationManager";
import { PermissionChecker } from "~/lib/permissions/PermissionChecker";
import { handleFunctions, resolveToolRepeatLimit } from "~/services/functions";
import type { IRequest, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { formatToolErrorResponse, formatToolResponse } from "~/utils/tool-responses";

import {
  buildRepeatedToolCallMessage,
  checkToolCallRepeat,
  type ToolCallLedger,
} from "./call-ledger";

const logger = getLogger({ prefix: "lib/chat/tools/execution" });
const permissionChecker = new PermissionChecker();

interface ToolCallError extends Error {
  functionName?: string;
  type?: string;
  status?: number;
  context?: Record<string, unknown>;
}

type ToolResultPersistenceMode = "batch" | "immediate" | "none";

function isUnknownToolError(error: ToolCallError): boolean {
  return error.context?.reason === "unknown_tool";
}

function buildUnknownToolCorrection(functionName: string): string {
  if (functionName.toLowerCase() === "artifact") {
    return "Artifacts are response markup, not tools. Return the artifact as assistant text using <artifact ...>...</artifact>.";
  }

  return `Tool "${functionName}" is not available. Continue using only the tools provided in this request, or answer directly without a tool.`;
}

function isRecoverableToolCallError(params: {
  errorType: string;
  toolCallId: unknown;
  functionName: string;
}): boolean {
  return (
    params.errorType === ErrorType.TOOL_CALL_ERROR &&
    typeof params.toolCallId === "string" &&
    params.toolCallId.length > 0 &&
    params.functionName !== "unknown"
  );
}

export const handleToolCalls = async (
  completion_id: string,
  modelResponse: any,
  conversationManager: ConversationManager,
  req: IRequest,
  options?: {
    persistResults?: ToolResultPersistenceMode;
    onToolResult?: (message: Message) => Promise<void> | void;
    recoverUnknownToolCalls?: boolean;
    callLedger?: ToolCallLedger;
  },
): Promise<Message[]> => {
  const functionResults: Message[] = [];
  const persistResults = options?.persistResults ?? "batch";
  const modelResponseLogId = req.env.AI.aiGatewayLogId;
  const timestamp = Date.now();

  const recordToolResult = async (message: Message) => {
    const messageWithParts = {
      ...message,
      parts: message.parts || buildMessageParts(message),
    };

    functionResults.push(messageWithParts);

    if (persistResults === "immediate") {
      try {
        await conversationManager.add(completion_id, messageWithParts);
      } catch (error) {
        logger.error("Failed to store streamed tool call result:", {
          error,
          completion_id,
          tool_name: messageWithParts.name,
        });
      }
    }

    await options?.onToolResult?.(messageWithParts);
  };

  const toolCalls = modelResponse.tool_calls || [];

  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const mode = req.mode || req.request?.mode;
  const toolPermissionsMap = req.request?.tool_permissions_map ?? {};

  for (const toolCall of toolCalls) {
    const functionName = toolCall.function?.name || toolCall.name || "unknown";

    logger.info(`Tool call: ${functionName}`);

    try {
      if (!toolCall.id) {
        throw new AssistantError("Missing tool call ID", ErrorType.TOOL_CALL_ERROR);
      }

      let recordToolCallAttempt: (() => void) | undefined;

      if (options?.callLedger) {
        const repeat = checkToolCallRepeat(
          options.callLedger,
          functionName,
          toolCall.function?.arguments ?? toolCall.arguments,
          resolveToolRepeatLimit(functionName),
        );

        if (repeat.repeated) {
          logger.warn(`Tool "${functionName}" repeated with identical arguments`, {
            attempts: repeat.attempts,
          });
          const repeatError = formatToolErrorResponse(
            functionName,
            buildRepeatedToolCallMessage(functionName, repeat.attempts),
            "REPEATED_TOOL_CALL",
          );

          await recordToolResult({
            role: "tool",
            name: functionName,
            content: repeatError.content,
            status: "error",
            data: { ...repeatError.data, errorCode: "REPEATED_TOOL_CALL" },
            log_id: modelResponseLogId || "",
            id: generateId(),
            tool_call_id: toolCall.id,
            tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
            timestamp,
            model: req.request?.model || "unknown",
            platform: req.request?.platform || "api",
          });
          continue;
        }

        recordToolCallAttempt = repeat.record;
      }

      const permissionResult = permissionChecker.checkRequestToolAccess({
        toolName: functionName,
        mode,
        user: req.user,
        toolPermissions: toolPermissionsMap[functionName],
        approvedTools: req.request?.approved_tools,
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

        await recordToolResult({
          role: "tool",
          name: functionName,
          content: blockedError.content,
          status: "error",
          data: blockedError.data,
          log_id: modelResponseLogId || "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        });
        continue;
      }

      if (permissionResult.requiresApproval && !permissionResult.approved) {
        logger.warn(`Tool "${functionName}" requires approval but was not pre-approved`, {
          mode,
        });
        const approvalReason =
          permissionResult.reason ??
          `Tool "${functionName}" requires explicit approval before it can run. Ask the user to confirm.`;
        const approvalError = formatToolErrorResponse(
          functionName,
          approvalReason,
          "APPROVAL_REQUIRED",
        );

        await recordToolResult({
          role: "tool",
          name: functionName,
          content: approvalError.content,
          status: "error",
          data: {
            ...approvalError.data,
            approvalRequired: true,
            approval: {
              toolName: functionName,
              toolCallId: toolCall.id,
              reason: approvalReason,
            },
          },
          log_id: modelResponseLogId || "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        });
        continue;
      }

      if (functionName === "memory") {
        const rawArgs = toolCall.function?.arguments || toolCall.arguments || "{}";
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
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        };

        await recordToolResult(memMessage);
        continue;
      }

      const rawArgs = toolCall.function?.arguments || toolCall.arguments;
      const functionArgs = safeParseJson(rawArgs);

      if (!functionArgs) {
        logger.error(`Failed to parse arguments for ${functionName}: ${rawArgs}`);
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
          emitToolResult: async (toolResult) => {
            const toolResultName = toolResult.name || functionName;
            const formattedResponse = formatToolResponse(
              toolResultName,
              toolResult.content || "",
              toolResult.data,
            );

            await recordToolResult({
              role: toolResult.role || "tool",
              name: toolResultName,
              content: formattedResponse.content,
              status: toolResult.status || "success",
              data: formattedResponse.data,
              log_id: toolResult.log_id || modelResponseLogId || "",
              id: toolResult.id || generateId(),
              tool_call_id: toolCall.id,
              tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
              timestamp: toolResult.timestamp || Date.now(),
              model: toolResult.model || req.request?.model || "unknown",
              platform: toolResult.platform || req.request?.platform || "api",
            });
          },
        });

        if (result?.status !== "error") {
          recordToolCallAttempt?.();
        }
      } catch (functionError: any) {
        logger.error(`Function execution error for ${functionName}:`, functionError);
        const errorType = functionError.type || "FUNCTION_EXECUTION_ERROR";
        const unknownTool = isUnknownToolError(functionError);
        const recoverable = unknownTool && options?.recoverUnknownToolCalls;
        const formattedError = formatToolErrorResponse(
          functionName,
          unknownTool
            ? buildUnknownToolCorrection(functionName)
            : functionError.message || "Function execution failed",
          errorType,
        );

        const errorMessage: Message = {
          role: "tool",
          name: functionName,
          content: formattedError.content,
          status: "error",
          data: unknownTool
            ? {
                ...formattedError.data,
                errorCode: "UNKNOWN_TOOL",
                ...(recoverable ? { recoverable: true } : {}),
              }
            : formattedError.data,
          log_id: modelResponseLogId || "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        };

        await recordToolResult(errorMessage);
        continue;
      }

      if (!result) {
        logger.warn(`No result returned for tool call ${functionName}`);
        const nullResultError = formatToolErrorResponse(
          functionName,
          "Tool returned no result",
          "EMPTY_RESULT",
        );

        await recordToolResult({
          role: "tool",
          name: functionName,
          content: nullResultError.content,
          status: "error",
          data: nullResultError.data,
          log_id: modelResponseLogId || "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        });
        continue;
      }

      const formattedResponse = formatToolResponse(functionName, result.content || "", result.data);

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
        timestamp: Date.now(),
        model: req.request?.model || "unknown",
        platform: req.request?.platform || "api",
      };

      await recordToolResult(message);
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
      const recoverable = isRecoverableToolCallError({
        errorType,
        toolCallId: toolCall.id,
        functionName,
      });

      const errorMessage: Message = {
        role: "tool",
        name: toolCall.name || functionName,
        content: formattedError.content,
        status: "error",
        data: recoverable ? { ...formattedError.data, recoverable: true } : formattedError.data,
        log_id: modelResponseLogId || "",
        id: generateId(),
        tool_call_id: toolCall.id,
        tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
        timestamp,
        model: req.request?.model || "unknown",
        platform: req.request?.platform || "api",
      };

      await recordToolResult(errorMessage);
    }
  }

  if (persistResults === "batch" && functionResults.length > 0) {
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

export function formatToolCalls(provider: string, functions: unknown[]): ProviderToolDefinition[] {
  if (!functions || !Array.isArray(functions)) {
    logger.warn("Invalid functions provided to formatToolCalls");

    return [];
  }

  const definitions = functions
    .map((func) => toCanonicalToolDefinition(func))
    .filter((definition): definition is ToolDefinition => definition !== null);

  return toProviderToolDefinitions(provider, definitions);
}

function toCanonicalToolDefinition(func: unknown): ToolDefinition | null {
  if (isToolDefinition(func)) {
    return func;
  }

  const candidate = func as {
    name?: string;
    description?: string;
    parameters?: { jsonSchema?: Record<string, unknown> } & Record<string, unknown>;
    inputSchema?: unknown;
  };

  if (!candidate?.name) {
    logger.warn("Skipping tool definition without a name");

    return null;
  }

  const parameters = resolveFunctionParameters(candidate);

  if (!parameters) {
    logger.warn(`Missing parameters for function ${candidate.name}`);

    return null;
  }

  return defineTool({
    name: candidate.name,
    description: candidate.description ?? "",
    schema: parameters,
  });
}

function resolveFunctionParameters(func: {
  name?: string;
  parameters?: { jsonSchema?: Record<string, unknown> } & Record<string, unknown>;
  inputSchema?: unknown;
}): Record<string, unknown> | null {
  if (func.parameters) {
    return func.parameters.jsonSchema || func.parameters;
  }

  if (!func.inputSchema) {
    return null;
  }

  try {
    return flattenObjectRootSchema(z.toJSONSchema(func.inputSchema as z.ZodType));
  } catch (error) {
    logger.warn("Failed to convert tool input schema to JSON schema", {
      name: func.name,
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    return null;
  }
}
