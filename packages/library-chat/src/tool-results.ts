import { ToolResponseType, type ToolReceipt } from "@ngriffin_uk/polychat-schemas";
import { isRecord, readOptionalString, titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types.js";
import { readToolReceipt } from "./tool-receipts.js";

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
  receipt?: ToolReceipt;
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
  contextId?: string;
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
    ...(typeof data.contextId === "string" && data.contextId ? { contextId: data.contextId } : {}),
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

function isApprovalRequestData(data: unknown): boolean {
  return isRecord(data) && data.renderer === "approval_request";
}

export function collectApprovalToolCallIds(messages: readonly Message[]): Set<string> {
  const toolCallIds = new Set<string>();

  for (const message of messages) {
    if (message.role === "tool" && message.tool_call_id && isApprovalRequestData(message.data)) {
      toolCallIds.add(message.tool_call_id);
    }

    for (const part of message.parts ?? []) {
      if (part.type === "tool_result" && part.toolCallId && isApprovalRequestData(part.data)) {
        toolCallIds.add(part.toolCallId);
      }
    }
  }

  return toolCallIds;
}

export interface PendingApproval {
  interactionId: string;
  toolName: string;
  approvalRequired: boolean;
  runId?: string;
}

function readPendingApproval(
  data: unknown,
  status: string | undefined,
  runId: string | undefined,
): PendingApproval | null {
  if (status !== "pending" || !isRecord(data) || !isApprovalRequestData(data) || data.resolved) {
    return null;
  }

  const approval = isRecord(data.approval) ? data.approval : undefined;
  const interactionId = approval?.interactionId;
  const toolName = approval?.toolName;

  if (typeof interactionId !== "string" || typeof toolName !== "string") {
    return null;
  }

  if (data.approvalRequired !== true && toolName !== "request_approval") {
    return null;
  }

  return {
    interactionId,
    toolName,
    approvalRequired: data.approvalRequired === true,
    ...(runId ? { runId } : {}),
  };
}

export function collectPendingApprovals(messages: readonly Message[]): PendingApproval[] {
  const pending = new Map<string, PendingApproval>();

  for (const message of messages) {
    const direct =
      message.role === "tool"
        ? readPendingApproval(message.data, message.status, message.run_id)
        : null;

    if (direct) {
      pending.set(direct.interactionId, direct);
    }

    for (const part of message.parts ?? []) {
      const fromPart =
        part.type === "tool_result"
          ? readPendingApproval(part.data, part.status, message.run_id)
          : null;

      if (fromPart && !pending.has(fromPart.interactionId)) {
        pending.set(fromPart.interactionId, fromPart);
      }
    }
  }

  const approvals = [...pending.values()];
  const latestRunId = approvals.at(-1)?.runId;

  return latestRunId ? approvals.filter((approval) => approval.runId === latestRunId) : approvals;
}

export function collectApprovalToolResponseContents(messages: readonly Message[]): Set<string> {
  const contents = new Set<string>();

  for (const message of messages) {
    if (
      message.role === "tool" &&
      isApprovalRequestData(message.data) &&
      typeof message.content === "string"
    ) {
      contents.add(message.content.trim());
    }

    for (const part of message.parts ?? []) {
      if (
        part.type === "tool_result" &&
        isApprovalRequestData(part.data) &&
        typeof part.content === "string"
      ) {
        contents.add(part.content.trim());
      }
    }
  }

  return contents;
}

export function isRedundantApprovalAssistantMessage(
  message: Message,
  approvalToolResponseContents: ReadonlySet<string>,
): boolean {
  return (
    message.role === "assistant" &&
    message.status === "pending" &&
    typeof message.content === "string" &&
    approvalToolResponseContents.has(message.content.trim())
  );
}

export function isApprovalResolutionMessage(message: Message): boolean {
  if (message.role !== "user" || !isRecord(message.data)) {
    return false;
  }

  const interaction = message.data.toolInteraction;
  const response = isRecord(interaction) ? interaction.response : undefined;

  return (
    isRecord(response) && (response.resolution === "approved" || response.resolution === "rejected")
  );
}

export function isApprovalOnlyAssistantMessage(
  message: Message,
  approvalToolCallIds: ReadonlySet<string>,
): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  const toolCallIds = message.tool_calls?.length
    ? message.tool_calls.map((toolCall) => toolCall.id)
    : (message.parts ?? []).flatMap((part) => (part.type === "tool_use" ? [part.toolCallId] : []));

  return (
    toolCallIds.length > 0 &&
    toolCallIds.every(
      (toolCallId) => typeof toolCallId === "string" && approvalToolCallIds.has(toolCallId),
    )
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
  const responseType = readOptionalString(data?.responseType);
  const hasNothingToShow = responseType === ToolResponseType.TEXT && !content.trim();

  return {
    name: toolName,
    label: readOptionalString(data?.formattedName) ?? titleCaseSlug(toolName),
    icon: readOptionalString(data?.icon),
    status,
    responseType,
    renderer: readOptionalString(data?.renderer),
    streamPreview: readToolStreamPreview(data),
    receipt: readToolReceipt(data),
    result: hasNothingToShow
      ? undefined
      : {
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
