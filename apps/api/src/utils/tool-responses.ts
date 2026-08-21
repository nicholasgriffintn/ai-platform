import type { MessageContent } from "~/types/chat";

import {
  formatFunctionName,
  getFunctionIcon,
  getFunctionRenderer,
  getFunctionResponseDisplay,
  getFunctionResponseType,
} from "./functions";

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
