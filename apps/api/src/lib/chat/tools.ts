import { handleFunctions } from "~/services/functions";
import type { IRequest, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import {
  formatToolErrorResponse,
  formatToolResponse,
} from "~/utils/tool-responses";
import type { ConversationManager } from "../conversationManager";

const logger = getLogger({ prefix: "TOOLS" });

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
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const toolMessage: Message = {
    role: "assistant",
    name: "External Functions",
    tool_calls: toolCalls,
    log_id: modelResponseLogId || "",
    content: "",
    id: generateId(),
    timestamp,
    model: req.request?.model,
    platform: req.request?.platform || "api",
  };

  functionResults.push(toolMessage);

  // Process tool calls individually
  for (const toolCall of toolCalls) {
    let functionName = "unknown";
    try {
      functionName = toolCall.function?.name || toolCall.name;
      if (!functionName) {
        throw new AssistantError(
          "Invalid tool call: missing function name",
          ErrorType.PARAMS_ERROR,
        );
      }

      const rawArgs = toolCall.function?.arguments || toolCall.arguments;
      let functionArgs = {};

      try {
        functionArgs =
          typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
      } catch (parseError) {
        logger.error(
          `Failed to parse arguments for ${functionName}:`,
          parseError,
        );
        functionArgs = rawArgs || {};
      }

      let result: any;
      try {
        result = await handleFunctions({
          completion_id,
          app_url: req.app_url,
          functionName,
          args: functionArgs,
          request: req,
        });
      } catch (functionError: any) {
        logger.error(
          `Function execution error for ${functionName}:`,
          functionError,
        );
        const formattedError = formatToolErrorResponse(
          functionName,
          functionError.message || "Function execution failed",
        );

        const errorMessage: Message = {
          role: "tool",
          name: functionName,
          content: formattedError.content,
          status: "error",
          data: formattedError.data,
          log_id: modelResponseLogId || "",
          id: toolCall.id || generateId(),
          timestamp: Date.now(),
          model: req.request?.model,
          platform: req.request?.platform || "api",
        };

        functionResults.push(errorMessage);
        continue;
      }

      if (!result) {
        logger.warn(`No result returned for tool call ${functionName}`);
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
        status: result.status,
        data: formattedResponse.data,
        log_id: modelResponseLogId || "",
        id: toolCall.id || generateId(),
        timestamp: Date.now(),
        model: req.request?.model,
        platform: req.request?.platform || "api",
      };

      // Add to batch and results
      functionResults.push(message);
    } catch (error) {
      const functionError = error as ToolCallError;
      logger.error(`Tool call error for ${functionName}:`, { error });

      const formattedError = formatToolErrorResponse(
        functionName,
        functionError.message || "Unknown error occurred",
      );

      const errorMessage: Message = {
        role: "tool",
        name: toolCall.name || functionName,
        content: formattedError.content,
        status: "error",
        data: formattedError.data,
        log_id: modelResponseLogId || "",
        id: toolCall.id || generateId(),
        timestamp: Date.now(),
        model: req.request?.model,
        platform: req.request?.platform || "api",
      };

      // Add to batch and results
      functionResults.push(errorMessage);
    }
  }

  // Store all messages at once using addBatch
  if (functionResults.length > 0) {
    try {
      await conversationManager.addBatch(completion_id, functionResults);
    } catch (error) {
      logger.error("Failed to store tool call results:", { error });
    }
  }

  return functionResults;
};
