import type { MessageContent } from "~/types/chat";
import { type ResponseDisplay, ResponseDisplayType } from "~/types/functions";
import {
  formatFunctionName,
  getFunctionIcon,
  getFunctionResponseDisplay,
  getFunctionResponseType,
} from "./functions";

/**
 * Formats a tool response for display in the UI
 * @param toolName The name of the tool
 * @param content The content of the tool response
 * @param data Additional data from the tool response
 * @returns Formatted tool response with display information
 */
export const formatToolResponse = (
  toolName: string,
  content: string | MessageContent[],
  data?: Record<string, any>,
): {
  content: string | MessageContent[];
  data: Record<string, any>;
} => {
  const responseType = getFunctionResponseType(toolName);
  const responseDisplay = getFunctionResponseDisplay(toolName);
  const icon = getFunctionIcon(toolName);
  const formattedName = formatFunctionName(toolName);

  return {
    content,
    data: {
      ...data,
      responseType,
      responseDisplay,
      icon,
      formattedName,
      name: toolName,
    },
  };
};

/**
 * Formats a tool error response for display in the UI
 * @param toolName The name of the tool
 * @param errorMessage The error message
 * @returns Formatted error response with display information
 */
export const formatToolErrorResponse = (
  toolName: string,
  errorMessage: string,
  errorType: string,
): {
  content: string;
  data: Record<string, any>;
} => {
  const responseType = ResponseDisplayType.TEXT;
  const responseDisplay: ResponseDisplay = {
    fields: [
      { key: "status", label: "Status" },
      { key: "content", label: "Error" },
    ],
    template: `
      <div class="error-response">
        <h2>${errorType}: ${formatFunctionName(toolName)}</h2>
        <p>{{content}}</p>
      </div>
    `,
  };

  return {
    content: errorMessage,
    data: {
      responseType,
      responseDisplay,
      icon: "alert-triangle",
      formattedName: formatFunctionName(toolName),
      name: toolName,
    },
  };
};
