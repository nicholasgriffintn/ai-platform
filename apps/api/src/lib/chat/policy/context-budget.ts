import type { AgentMessage } from "@ngriffin_uk/polychat-library-agent-core";
import {
  CHAT_CONTEXT_PROTOCOL_VERSION,
  type ChatContextApproval,
  type ChatContextOmission,
  type ChatContextSkill,
  type ChatContextSnapshot,
  type ChatContextSource,
  type ChatContextSummary,
} from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";

const DEFAULT_CONTEXT_WINDOW = 8000;
const DEFAULT_OUTPUT_RESERVE_RATIO = 0.15;
const DEFAULT_MAX_TOOL_RESULT_CHARACTERS = 6000;
const MESSAGE_OVERHEAD_TOKENS = 4;

export interface ContextBudgetSkill {
  id: string;
  name: string;
}

export type ContextBudgetMessage = AgentMessage & {
  id?: string;
  data?: Record<string, unknown>;
  parts?: unknown[];
};

export interface ContextBudgetInput {
  messages: readonly ContextBudgetMessage[];
  contextWindow?: number;
  systemPrompt: string;
  maxOutputTokens?: number;
  maxToolResultCharacters?: number;
  runId: string;
  conversationId: string;
  attempt: number;
  step: number;
  model: string;
  provider: string;
  generatedAt?: string;
  skills?: readonly ContextBudgetSkill[];
}

export interface ContextBudgetResult {
  messages: ContextBudgetMessage[];
  snapshot: ChatContextSnapshot;
}

interface IndexedMessage {
  index: number;
  message: ContextBudgetMessage;
  tokens: number;
}

interface SourceReference {
  id: string;
  name: string;
  retrievalPath: string | null;
  messageId: string | null;
  messageIndex: number;
}

function contentText(content: AgentMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  if (content === null) {
    return "";
  }

  try {
    return JSON.stringify(content) ?? "";
  } catch {
    return "";
  }
}

function estimateTokens(message: AgentMessage): number {
  const charactersPerToken = message.role === "tool" ? 6 : 4;

  return (
    Math.ceil(contentText(message.content).length / charactersPerToken) + MESSAGE_OVERHEAD_TOKENS
  );
}

function resolveContextWindow(value: number | undefined): number {
  return value && Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_CONTEXT_WINDOW;
}

function resolveInputBudget(contextWindow: number, maxOutputTokens: number | undefined): number {
  const defaultReserve = Math.max(1, Math.floor(contextWindow * DEFAULT_OUTPUT_RESERVE_RATIO));
  const requestedReserve =
    maxOutputTokens && Number.isFinite(maxOutputTokens) && maxOutputTokens > 0
      ? Math.floor(maxOutputTokens)
      : defaultReserve;
  const reserve = Math.min(requestedReserve, Math.max(contextWindow - 1, 1));

  return Math.max(contextWindow - reserve, 1);
}

function messageId(message: ContextBudgetMessage): string | null {
  return typeof message.id === "string" && message.id ? message.id : null;
}

function retrievalPathForMessage(message: ContextBudgetMessage): string | null {
  const id = messageId(message);

  return id ? `/chat/messages/${encodeURIComponent(id)}` : null;
}

function shortenToolResult(
  message: ContextBudgetMessage,
  maxCharacters: number,
): { message: ContextBudgetMessage; omission?: ChatContextOmission } {
  if (message.role !== "tool") {
    return { message };
  }

  const fullText = contentText(message.content);

  if (fullText.length <= maxCharacters) {
    return { message };
  }

  const marker = `[Tool result shortened; ${fullText.length.toLocaleString()} characters stored separately.]`;
  const available = Math.max(maxCharacters - marker.length - 2, 20);
  const headLength = Math.ceil(available * 0.7);
  const tailLength = Math.max(available - headLength, 1);
  const shortened = `${marker}\n${fullText.slice(0, headLength)}\n…\n${fullText.slice(-tailLength)}`;
  const id = messageId(message);

  return {
    message: { ...message, content: shortened },
    omission: {
      id: `tool-result:${id ?? "unpersisted"}`,
      kind: "tool_result",
      reason: "bounded",
      count: 1,
      messageId: id,
      retrievalPath: retrievalPathForMessage(message),
    },
  };
}

function buildConversationUnits(messages: readonly IndexedMessage[]): IndexedMessage[][] {
  const units: IndexedMessage[][] = [];

  for (const entry of messages) {
    const startsUnit = entry.message.role === "user" || entry.message.role === "assistant";

    if (startsUnit || units.length === 0) {
      units.push([entry]);
    } else {
      units[units.length - 1]?.push(entry);
    }
  }

  return units;
}

function unitTokens(unit: readonly IndexedMessage[]): number {
  return unit.reduce((sum, entry) => sum + entry.tokens, 0);
}

function findPriorityUnit(
  units: readonly IndexedMessage[][],
  predicate: (entry: IndexedMessage) => boolean,
): IndexedMessage[] | undefined {
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];

    if (unit?.some(predicate)) {
      return unit;
    }
  }

  return undefined;
}

function addUnit(
  unit: readonly IndexedMessage[] | undefined,
  selectedIndexes: Set<number>,
  availableTokens: number,
): number {
  if (!unit || unit.every((entry) => selectedIndexes.has(entry.index))) {
    return availableTokens;
  }

  const requiredTokens = unitTokens(unit);

  if (requiredTokens > availableTokens) {
    return availableTokens;
  }

  unit.forEach((entry) => selectedIndexes.add(entry.index));

  return availableTokens - requiredTokens;
}

function snapshotPart(message: ContextBudgetMessage): Record<string, unknown> | null {
  if (!Array.isArray(message.parts)) {
    return null;
  }

  for (const part of message.parts) {
    if (isRecord(part) && part.type === "snapshot") {
      return part;
    }
  }

  return null;
}

function readSummary(
  messages: readonly ContextBudgetMessage[],
  selectedIndexes: ReadonlySet<number>,
): ChatContextSummary | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    const part = snapshotPart(message);

    if (!part || typeof part.summary !== "string") {
      continue;
    }

    const coverage = isRecord(part.coverage) ? part.coverage : {};
    const representedMessageCount =
      typeof coverage.coveredMessageCount === "number" ? coverage.coveredMessageCount : 0;
    const candidateMessageCount =
      typeof coverage.candidateMessageCount === "number"
        ? coverage.candidateMessageCount
        : representedMessageCount;

    return {
      messageId: messageId(message) ?? `snapshot:${index}`,
      status: selectedIndexes.has(index) ? "included" : "omitted",
      text: part.summary.slice(0, 16000),
      representedMessageCount,
      candidateMessageCount,
      fallback: coverage.strategy === "fallback_transcript",
    };
  }

  return null;
}

function attachmentName(part: Record<string, unknown>, fallback: string): string {
  const payloadKeys = ["document_url", "markdown_document", "image_url", "audio_url", "video_url"];

  for (const key of payloadKeys) {
    const payload = part[key];

    if (isRecord(payload) && typeof payload.name === "string" && payload.name.trim()) {
      return payload.name.trim();
    }
  }

  return fallback;
}

function attachmentUrl(part: Record<string, unknown>): string | null {
  for (const key of ["document_url", "image_url", "audio_url", "video_url"]) {
    const payload = part[key];

    if (isRecord(payload) && typeof payload.url === "string") {
      return payload.url;
    }
  }

  return null;
}

function sourceIdFromUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(/\/sources\/([^/?#]+)\/content(?:[?#]|$)/);

  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function readSources(messages: readonly ContextBudgetMessage[]): SourceReference[] {
  const sources = new Map<string, SourceReference>();

  messages.forEach((message, messageIndex) => {
    if (!Array.isArray(message.content)) {
      return;
    }

    message.content.forEach((part, partIndex) => {
      if (
        !isRecord(part) ||
        typeof part.type !== "string" ||
        (!part.type.includes("url") && part.type !== "markdown_document")
      ) {
        return;
      }

      const url = attachmentUrl(part);
      const explicitId = typeof part.source_id === "string" ? part.source_id : null;
      const sourceId = explicitId ?? sourceIdFromUrl(url);
      const id = sourceId ?? `attachment:${messageId(message) ?? messageIndex}:${partIndex}`;

      if (sources.has(id)) {
        return;
      }

      sources.set(id, {
        id,
        name: attachmentName(part, sourceId ? "Attached source" : "Attachment"),
        retrievalPath: sourceId
          ? `/sources/${encodeURIComponent(sourceId)}/content`
          : retrievalPathForMessage(message),
        messageId: messageId(message),
        messageIndex,
      });
    });
  });

  return [...sources.values()];
}

function readSkills(
  messages: readonly ContextBudgetMessage[],
  selectedIndexes: ReadonlySet<number>,
  availableSkills: readonly ContextBudgetSkill[],
): ChatContextSkill[] {
  const loaded = new Map<string, number | undefined>();

  messages.forEach((message, index) => {
    if (
      !selectedIndexes.has(index) ||
      message.role !== "tool" ||
      message.name !== "load_skill" ||
      message.status !== "success" ||
      !isRecord(message.data) ||
      typeof message.data.skill !== "string"
    ) {
      return;
    }

    const provenance = isRecord(message.data.provenance) ? message.data.provenance : null;
    const revision =
      provenance && typeof provenance.revision === "number" ? provenance.revision : undefined;

    loaded.set(message.data.skill, revision);
  });

  const skills = new Map<string, ChatContextSkill>();

  availableSkills.forEach((skill) => {
    const revision = loaded.get(skill.id);
    const isLoaded = loaded.has(skill.id);

    skills.set(skill.id, {
      id: skill.id,
      name: skill.name,
      state: isLoaded ? "loaded" : "available",
      ...(revision === undefined ? {} : { revision }),
    });
  });

  loaded.forEach((revision, id) => {
    if (!skills.has(id)) {
      skills.set(id, {
        id,
        name: id,
        state: "loaded",
        ...(revision === undefined ? {} : { revision }),
      });
    }
  });

  return [...skills.values()].sort((left, right) => {
    if (left.state !== right.state) {
      return left.state === "loaded" ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function readApprovals(messages: readonly ContextBudgetMessage[]): ChatContextApproval[] {
  const approvals = new Map<string, ChatContextApproval>();

  for (const message of messages) {
    if (!isRecord(message.data)) {
      continue;
    }

    const humanInTheLoop = isRecord(message.data.humanInTheLoop)
      ? message.data.humanInTheLoop
      : null;
    const approval = isRecord(message.data.approval) ? message.data.approval : null;
    const type = humanInTheLoop?.type;
    const id =
      typeof humanInTheLoop?.interactionId === "string"
        ? humanInTheLoop.interactionId
        : typeof approval?.interactionId === "string"
          ? approval.interactionId
          : null;

    if ((type !== "approval" && type !== "question") || !id) {
      continue;
    }

    const resolution = humanInTheLoop.resolution ?? message.data.resolution ?? approval?.status;
    const rawStatus = humanInTheLoop.status;
    const status =
      resolution === "approved" || resolution === "rejected"
        ? resolution
        : rawStatus === "pending" ||
            rawStatus === "resolved" ||
            rawStatus === "expired" ||
            rawStatus === "interrupted"
          ? rawStatus
          : "pending";
    const toolName =
      typeof humanInTheLoop.toolName === "string"
        ? humanInTheLoop.toolName
        : typeof approval?.toolName === "string"
          ? approval.toolName
          : null;

    approvals.set(id, {
      id,
      type,
      status,
      toolName,
      messageId: messageId(message),
    });
  }

  return [...approvals.values()];
}

export function fitMessagesToContextBudget(input: ContextBudgetInput): ContextBudgetResult {
  const contextWindow = resolveContextWindow(input.contextWindow);
  const maxInputTokens = resolveInputBudget(contextWindow, input.maxOutputTokens);
  const maxToolResultCharacters = Math.max(
    80,
    Math.floor(input.maxToolResultCharacters ?? DEFAULT_MAX_TOOL_RESULT_CHARACTERS),
  );
  const omissions: ChatContextOmission[] = [];
  const indexed = input.messages.map((message, index): IndexedMessage => {
    const bounded = shortenToolResult(message, maxToolResultCharacters);

    if (bounded.omission) {
      omissions.push(bounded.omission);
    }

    return { index, message: bounded.message, tokens: estimateTokens(bounded.message) };
  });
  const fixed = indexed.filter(
    (entry) => entry.message.role === "system" || entry.message.role === "developer",
  );
  const conversation = indexed.filter(
    (entry) => entry.message.role !== "system" && entry.message.role !== "developer",
  );
  const systemTokens = Math.ceil(input.systemPrompt.length / 4);
  let availableTokens = maxInputTokens - systemTokens - unitTokens(fixed);

  if (availableTokens < 0) {
    throw new AssistantError(
      "System instructions exceed the model context budget",
      ErrorType.CONTEXT_WINDOW_EXCEEDED,
    );
  }

  const units = buildConversationUnits(conversation);
  const selectedIndexes = new Set(fixed.map((entry) => entry.index));
  const latestUserUnit = findPriorityUnit(
    units,
    (entry) => entry.message.role === "user" && entry.message.data?.contextControl !== true,
  );
  const summaryUnit = findPriorityUnit(units, (entry) => snapshotPart(entry.message) !== null);
  const latestUserTokens = latestUserUnit ? unitTokens(latestUserUnit) : 0;

  if (latestUserTokens > availableTokens) {
    throw new AssistantError(
      "The latest user message exceeds the model context budget",
      ErrorType.CONTEXT_WINDOW_EXCEEDED,
    );
  }

  availableTokens = addUnit(latestUserUnit, selectedIndexes, availableTokens);
  availableTokens = addUnit(summaryUnit, selectedIndexes, availableTokens);

  for (let index = units.length - 1; index >= 0; index -= 1) {
    availableTokens = addUnit(units[index], selectedIndexes, availableTokens);
  }

  const selectedMessages = indexed
    .filter((entry) => selectedIndexes.has(entry.index))
    .map((entry) => entry.message);
  const omitted = indexed.filter((entry) => !selectedIndexes.has(entry.index));

  if (omitted.length > 0) {
    const only = omitted.length === 1 ? omitted[0]?.message : undefined;
    const id = only ? messageId(only) : null;

    omissions.push({
      id: `history:${id ?? `${omitted[0]?.index ?? 0}-${omitted.length}`}`,
      kind: "history",
      reason: "context_window",
      count: omitted.length,
      messageId: id,
      retrievalPath: only ? retrievalPathForMessage(only) : null,
    });
  }

  const sourceReferences = readSources(input.messages);
  const sources: ChatContextSource[] = sourceReferences.map((source) => ({
    id: source.id,
    name: source.name,
    status: selectedIndexes.has(source.messageIndex) ? "included" : "omitted",
    retrievalPath: source.retrievalPath,
    messageId: source.messageId,
  }));

  sources
    .filter((source) => source.status === "omitted")
    .forEach((source) => {
      omissions.push({
        id: `source:${source.id}`,
        kind: "source",
        reason: "context_window",
        count: 1,
        messageId: source.messageId,
        retrievalPath: source.retrievalPath,
      });
    });

  const estimatedInputTokens =
    systemTokens + selectedMessages.reduce((sum, message) => sum + estimateTokens(message), 0);

  return {
    messages: selectedMessages,
    snapshot: {
      protocolVersion: CHAT_CONTEXT_PROTOCOL_VERSION,
      runId: input.runId,
      conversationId: input.conversationId,
      attempt: input.attempt,
      step: input.step,
      model: input.model,
      provider: input.provider,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      usage: {
        inputTokens: estimatedInputTokens,
        contextWindow,
        source: "estimated",
      },
      messages: { included: selectedMessages.length, omitted: omitted.length },
      sources,
      skills: readSkills(input.messages, selectedIndexes, input.skills ?? []),
      approvals: readApprovals(input.messages),
      summary: readSummary(input.messages, selectedIndexes),
      omissions,
    },
  };
}

export function applyReportedContextUsage(
  snapshot: ChatContextSnapshot,
  reportedInputTokens: number | undefined,
): ChatContextSnapshot {
  if (
    reportedInputTokens === undefined ||
    !Number.isFinite(reportedInputTokens) ||
    reportedInputTokens < 0
  ) {
    return snapshot;
  }

  return {
    ...snapshot,
    usage: {
      ...snapshot.usage,
      inputTokens: Math.floor(reportedInputTokens),
      source: "reported",
    },
  };
}
