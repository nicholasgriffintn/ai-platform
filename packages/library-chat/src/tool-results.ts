import { ToolResponseType } from "@ngriffin_uk/polychat-schemas";
import { isRecord, readOptionalString, titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types";

export { applyToolInteractionResolutions } from "./tool-interaction-resolutions";

type ToolResultPart = Extract<NonNullable<Message["parts"]>[number], { type: "tool_result" }>;
type MessagePart = NonNullable<Message["parts"]>[number];

export interface ToolResultDisplay {
  name: string;
  label: string;
  icon?: string;
  status?: string;
  responseType?: string;
  renderer?: string;
  result?: Record<string, unknown>;
}

export function isHiddenToolResponse(message: Message): boolean {
  return (
    message.role === "tool" &&
    isRecord(message.data) &&
    message.data.responseType === ToolResponseType.HIDDEN
  );
}

export function isHiddenToolResultPart(part: ToolResultPart): boolean {
  return isRecord(part.data) && part.data.responseType === ToolResponseType.HIDDEN;
}

export function getResolvedToolUseIndexes(
  parts: readonly MessagePart[],
  externallyResolvedToolCallIds: ReadonlySet<string> = new Set(),
): ReadonlySet<number> {
  const resultIds = new Set(
    parts.flatMap((part) =>
      part.type === "tool_result" && part.toolCallId ? [part.toolCallId] : [],
    ),
  );
  const resolvedIndexes = new Set<number>();
  const pendingByName = new Map<string, number[]>();

  parts.forEach((part, index) => {
    if (part.type === "tool_use") {
      if (
        part.toolCallId &&
        (resultIds.has(part.toolCallId) || externallyResolvedToolCallIds.has(part.toolCallId))
      ) {
        resolvedIndexes.add(index);

        return;
      }

      const pending = pendingByName.get(part.name) ?? [];

      pending.push(index);
      pendingByName.set(part.name, pending);

      return;
    }

    if (part.type !== "tool_result" || !part.name) {
      return;
    }

    const pending = pendingByName.get(part.name);
    const pendingIndex = pending?.shift();

    if (pendingIndex !== undefined) {
      resolvedIndexes.add(pendingIndex);
    }
  });

  return resolvedIndexes;
}

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
    label: readOptionalString(data?.formattedName) ?? titleCaseSlug(toolName),
    icon: readOptionalString(data?.icon),
    status,
    responseType: readOptionalString(data?.responseType),
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
  const isToolSearch = part.name === "tool_search" && Array.isArray(part.content);
  const data = isRecord(part.data) ? part.data : undefined;

  return buildDisplay({
    name: part.name,
    data: isToolSearch ? { ...data, responseType: "text" } : data,
    status: part.status,
    content: isToolSearch
      ? resolveLegacyToolSearchContent(part.content as unknown[])
      : resolveToolResultContent(part.content),
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

function resolveLegacyToolSearchContent(content: unknown[]): string {
  return content
    .map((tool) => {
      if (!isRecord(tool)) {
        return typeof tool === "string" ? tool : undefined;
      }

      const name = readOptionalString(tool.name) ?? readOptionalString(tool.type) ?? "Unknown tool";
      const description = readOptionalString(tool.description);

      return description ? `${name} — ${description}` : name;
    })
    .filter((tool): tool is string => !!tool)
    .join("\n");
}
