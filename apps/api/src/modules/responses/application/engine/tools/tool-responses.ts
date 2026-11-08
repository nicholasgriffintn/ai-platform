import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  formatFunctionName,
  getFunctionIcon,
  getFunctionRenderer,
  getFunctionResponseType,
} from "~/modules/tools/application/functions";
import type { MessageContent } from "~/types/chat";

export const TOOL_ERROR_UNCHANGED_NEXT =
  "Do not repeat this call unchanged; it will fail the same way.";
export const TOOL_ERROR_BLOCKED_NEXT =
  "Do not retry; tell the user what blocked it and offer an alternative.";
export const TOOL_ERROR_TRANSIENT_NEXT =
  "This may be temporary: retry once at most, then explain the failure.";

const TOOL_ERROR_NEXT: Record<string, string> = {
  [ErrorType.PARAMS_ERROR]: TOOL_ERROR_UNCHANGED_NEXT,
  [ErrorType.TOOL_CALL_ERROR]: TOOL_ERROR_UNCHANGED_NEXT,
  [ErrorType.NOT_FOUND]: TOOL_ERROR_UNCHANGED_NEXT,
  [ErrorType.CONFLICT_ERROR]: TOOL_ERROR_UNCHANGED_NEXT,
  [ErrorType.AUTHENTICATION_ERROR]: TOOL_ERROR_BLOCKED_NEXT,
  [ErrorType.AUTHORISATION_ERROR]: TOOL_ERROR_BLOCKED_NEXT,
  [ErrorType.FORBIDDEN]: TOOL_ERROR_BLOCKED_NEXT,
  [ErrorType.UNAUTHORIZED]: TOOL_ERROR_BLOCKED_NEXT,
  [ErrorType.USAGE_LIMIT_ERROR]: TOOL_ERROR_BLOCKED_NEXT,
  [ErrorType.CONFIGURATION_ERROR]: TOOL_ERROR_BLOCKED_NEXT,
  PERMISSION_DENIED: TOOL_ERROR_BLOCKED_NEXT,
  [ErrorType.NETWORK_ERROR]: TOOL_ERROR_TRANSIENT_NEXT,
  [ErrorType.RATE_LIMIT_ERROR]: TOOL_ERROR_TRANSIENT_NEXT,
  [ErrorType.PROVIDER_ERROR]: TOOL_ERROR_TRANSIENT_NEXT,
  [ErrorType.EXTERNAL_API_ERROR]: TOOL_ERROR_TRANSIENT_NEXT,
};

export const resolveToolErrorNext = (errorType: string): string | undefined =>
  TOOL_ERROR_NEXT[errorType];

export const formatToolResponse = (
  toolName: string,
  content: string | MessageContent[],
  data?: Record<string, any>,
  next?: string,
): {
  content: string | MessageContent[];
  data: Record<string, any>;
} => {
  const responseType = data?.responseType ?? getFunctionResponseType(toolName);
  const renderer = data?.renderer ?? getFunctionRenderer(toolName);
  const icon = data?.icon ?? getFunctionIcon(toolName);
  const formattedName = data?.formattedName ?? formatFunctionName(toolName);

  return {
    content,
    data: {
      ...data,
      ...(responseType ? { responseType } : {}),
      ...(renderer ? { renderer } : {}),
      ...(next ? { next } : {}),
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
  next?: string,
): {
  content: string;
  data: Record<string, any>;
} => {
  return {
    content: errorMessage,
    data: {
      error: errorMessage,
      errorType,
      ...(next ? { next } : {}),
      icon: "alert-triangle",
      formattedName: formatFunctionName(toolName),
      name: toolName,
    },
  };
};
