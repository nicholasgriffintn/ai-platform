import { ToolResponseType } from "@ngriffin_uk/polychat-schemas";
import { isRecord, readOptionalString, titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types.js";

export { applyToolInteractionResolutions } from "./tool-interaction-resolutions.js";

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
  streamPreview?: ToolStreamPreview;
}

export interface ToolStreamPreview {
  truncated: true;
  fullMessageId?: string;
  originalCharacters?: number;
  previewCharacters?: number;
}

export function readToolStreamPreview(
  data: Record<string, unknown> | undefined,
): ToolStreamPreview | undefined {
  const preview = data && isRecord(data.streamPreview) ? data.streamPreview : undefined;

  if (!preview || preview.truncated !== true) {
    return undefined;
  }

  return {
    truncated: true,
    ...(typeof preview.fullMessageId === "string" ? { fullMessageId: preview.fullMessageId } : {}),
    ...(typeof preview.originalCharacters === "number"
      ? { originalCharacters: preview.originalCharacters }
      : {}),
    ...(typeof preview.previewCharacters === "number"
      ? { previewCharacters: preview.previewCharacters }
      : {}),
  };
}

export const COMPUTER_OBSERVATION_RENDERER = "computer_observation";

export const CHROMELESS_TOOL_RENDERERS: ReadonlySet<string> = new Set([
  COMPUTER_OBSERVATION_RENDERER,
]);

export function shouldHideToolChrome(renderer: string | undefined): boolean {
  return typeof renderer === "string" && CHROMELESS_TOOL_RENDERERS.has(renderer);
}

export interface ComputerObservation {
  id: string;
  screenshot: string | null;
  title: string;
  width: number;
  height: number;
}

const readDimension = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readComputerObservationData = (data: unknown): Omit<ComputerObservation, "id"> | null => {
  if (!isRecord(data) || data.renderer !== COMPUTER_OBSERVATION_RENDERER) {
    return null;
  }

  const screenshot =
    typeof data.screenshot === "string" && data.screenshot ? data.screenshot : null;

  return {
    screenshot,
    title: readOptionalString(data.title) ?? "Hosted computer",
    width: readDimension(data.width, 1440),
    height: readDimension(data.height, 900),
  };
};

export function getComputerObservations(
  messages: readonly Message[] | undefined,
): ComputerObservation[] {
  const observations: ComputerObservation[] = [];

  for (const message of messages ?? []) {
    const parts = Array.isArray(message.parts) ? message.parts : [];

    for (const part of parts) {
      if (part.type !== "tool_result") {
        continue;
      }

      const observation = readComputerObservationData(isRecord(part.data) ? part.data : undefined);

      if (observation) {
        observations.push({
          id: `${message.id}:${part.toolCallId ?? part.name ?? observations.length}`,
          ...observation,
        });
      }
    }

    if (parts.length === 0 && message.role === "tool") {
      const observation = readComputerObservationData(
        isRecord(message.data) ? message.data : undefined,
      );

      if (observation) {
        observations.push({ id: message.id, ...observation });
      }
    }
  }

  return observations;
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
    streamPreview: readToolStreamPreview(data),
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
  const data = isRecord(message.data) ? message.data : undefined;

  return buildDisplay({
    name: message.name,
    data,
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
