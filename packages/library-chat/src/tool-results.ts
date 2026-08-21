import { ResponseDisplayType } from "@ngriffin_uk/polychat-schemas";
import { isRecord, readOptionalString } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types";

type ToolResultPart = Extract<NonNullable<Message["parts"]>[number], { type: "tool_result" }>;

export interface ToolResultDisplay {
  name: string;
  label: string;
  icon?: string;
  status?: string;
  responseType?: string;
  responseDisplay?: unknown;
  renderer?: string;
  result?: Record<string, unknown>;
}

export function isHiddenToolResponse(message: Message): boolean {
  return (
    message.role === "tool" &&
    isRecord(message.data) &&
    message.data.responseType === ResponseDisplayType.HIDDEN
  );
}

export function isHiddenToolResultPart(part: ToolResultPart): boolean {
  return isRecord(part.data) && part.data.responseType === ResponseDisplayType.HIDDEN;
}

const humaniseToolName = (name: string): string =>
  name
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const buildDisplay = ({
  name,
  data,
  status,
  content,
}: {
  name?: string;
  data?: Record<string, unknown>;
  status?: string;
  content: string;
}): ToolResultDisplay => {
  const toolName = name ?? readOptionalString(data?.name) ?? "Tool";

  return {
    name: toolName,
    label: readOptionalString(data?.formattedName) ?? humaniseToolName(toolName),
    icon: readOptionalString(data?.icon),
    status,
    responseType: readOptionalString(data?.responseType),
    responseDisplay: data?.responseDisplay,
    renderer: readOptionalString(data?.renderer),
    result: {
      status: status ?? "success",
      name: toolName,
      content,
      data,
    },
  };
};

export function resolveToolResultPartDisplay(part: ToolResultPart): ToolResultDisplay {
  return buildDisplay({
    name: part.name,
    data: isRecord(part.data) ? part.data : undefined,
    status: part.status,
    content: resolveToolResultContent(part.content),
  });
}

export function resolveToolMessageDisplay(message: Message): ToolResultDisplay {
  return buildDisplay({
    name: message.name,
    data: isRecord(message.data) ? message.data : undefined,
    status: message.status,
    content: typeof message.content === "string" ? message.content : "",
  });
}

function resolveToolResultContent(content: ToolResultPart["content"]) {
  if (typeof content === "string") {
    return content;
  }

  if (content) {
    return JSON.stringify(content, null, 2);
  }

  return "";
}
