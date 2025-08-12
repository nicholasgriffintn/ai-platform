import type { ConversationManager } from "~/lib/conversationManager";
import { handleFunctions } from "~/services/functions";
import type { IRequest, Message } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import {
  formatToolErrorResponse,
  formatToolResponse,
} from "~/utils/tool-responses";

const logger = getLogger({ prefix: "CHAT:TOOLS" });

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
  const functionResults: Message[] = [];
  const modelResponseLogId = req.env.AI.aiGatewayLogId;
  const timestamp = Date.now();

  const toolCalls = modelResponse.tool_calls || [];
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  for (const toolCall of toolCalls) {
    const functionName = toolCall.function?.name || toolCall.name || "unknown";
    logger.info(`Tool call: ${functionName}`);

    try {
      if (!toolCall.id) {
        throw new Error("Missing tool call ID");
      }

      if (functionName === "memory") {
        const rawArgs =
          toolCall.function?.arguments || toolCall.arguments || "{}";
        let memoryArgs;

        try {
          memoryArgs =
            typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
        } catch (parseError: any) {
          logger.error(`Failed to parse memory arguments: ${parseError}`);
          throw new Error(
            `Invalid memory tool arguments: ${parseError.message}`,
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
        functionResults.push(memMessage);
        continue;
      }

      const rawArgs = toolCall.function?.arguments || toolCall.arguments;
      let functionArgs = {};

      try {
        functionArgs =
          typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
      } catch (parseError: any) {
        logger.error(
          `Failed to parse arguments for ${functionName}:`,
          parseError,
        );
        throw new Error(
          `Invalid arguments for ${functionName}: ${parseError.message}`,
        );
      }

      if (!functionArgs || typeof functionArgs !== "object") {
        throw new Error(
          `Invalid arguments format for ${functionName}: expected object`,
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

        functionResults.push(errorMessage);
        continue;
      }

      if (!result) {
        logger.warn(`No result returned for tool call ${functionName}`);
        const nullResultError = formatToolErrorResponse(
          functionName,
          "Tool returned no result",
          "EMPTY_RESULT",
        );

        functionResults.push({
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
        });
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

      functionResults.push(message);
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

      functionResults.push(errorMessage);
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
        const parameters = func.parameters?.jsonSchema || func.parameters;
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
        if (!func.parameters) {
          logger.warn(`Missing parameters for function ${func.name}`);
          return null;
        }

        return {
          name: func.name,
          description: func.description,
          input_schema: func.parameters,
        };
      })
      .filter(Boolean);
  }

  return functions
    .map((func) => {
      const parameters = func.parameters?.jsonSchema || func.parameters;

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
