import type { MessageContent } from "~/types/chat";

import {
  formatFunctionName,
  getFunctionIcon,
  getFunctionRenderer,
  getFunctionResponseDisplay,
  getFunctionResponseType,
} from "./functions";

/**
 * Decorates a tool response with the presentation metadata the conversation renderer reads:
 * a stable renderer id, an icon, a human label, and any response type the tool declares. A tool
 * that declares nothing is rendered from the shape of its payload.
 */
export const formatToolResponse = (
  toolName: string,
  content: string | MessageContent[],
  data?: Record<string, any>,
): {
  content: string | MessageContent[];
  data: Record<string, any>;
} => {
  const responseType = data?.responseType ?? getFunctionResponseType(toolName);
  const responseDisplay = data?.responseDisplay ?? getFunctionResponseDisplay(toolName);
  const renderer = data?.renderer ?? getFunctionRenderer(toolName);
  const icon = data?.icon ?? getFunctionIcon(toolName);
  const formattedName = data?.formattedName ?? formatFunctionName(toolName);

  return {
    content,
    data: {
      ...data,
      ...(responseType ? { responseType } : {}),
      ...(responseDisplay ? { responseDisplay } : {}),
      ...(renderer ? { renderer } : {}),
      icon,
      formattedName,
      name: data?.name ?? toolName,
    },
  };
};

/**
 * Failures carry no response type: the client renders them from `status`, so a broken tool cannot
 * pass for a working one by borrowing a successful tool's presentation.
 */
export const formatToolErrorResponse = (
  toolName: string,
  errorMessage: string,
  errorType: string,
): {
  content: string;
  data: Record<string, any>;
} => {
  return {
    content: errorMessage,
    data: {
      error: errorMessage,
      errorType,
      icon: "alert-triangle",
      formattedName: formatFunctionName(toolName),
      name: toolName,
    },
  };
};
