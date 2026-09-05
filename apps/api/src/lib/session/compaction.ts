import { hasCompactionPart, isCompactionMarkerMessage } from "~/lib/chat/messages/parts";
import {
  estimateConversationTokens,
  estimateMessageTokens,
  messageToText,
  type MessageTokenInput,
} from "~/lib/messageTokens";
import type { Message } from "~/types";

export interface CompactionWindowConfig {
  contextWindow?: number;
  mode?: CompactionMode;
  triggerRatio?: number;
  maxTriggerTokens?: number;
  keepRecentMessages?: number;
  maxSummaryCharacters?: number;
}

export type CompactionMode = "auto" | "manual" | "off";

export type CompactionPlanMessage = MessageTokenInput;

export interface CompactionPlan<TMessage extends CompactionPlanMessage = Message> {
  shouldCompact: boolean;
  messagesToArchive: TMessage[];
  messagesToKeep: TMessage[];
  snapshotInsertionIndex: number;
  candidateMessageCount: number;
  summaryInput: string;
}

const DEFAULT_CONTEXT_WINDOW = 32000;
const DEFAULT_TRIGGER_RATIO = 0.7;
const DEFAULT_KEEP_RECENT_MESSAGES = 8;

const DEFAULT_MAX_TRIGGER_TOKENS = 200000;
const DEFAULT_MAX_SUMMARY_CHARACTERS = 16000;

export { estimateConversationTokens, estimateMessageTokens };

function countsTowardCompactionPressure(message: CompactionPlanMessage): boolean {
  return !isCompactionMarkerMessage(message) && !hasCompactionPart(message);
}

function canArchiveDuringCompaction(message: CompactionPlanMessage): boolean {
  if (message.role === "system" || message.role === "developer") {
    return false;
  }

  if (!countsTowardCompactionPressure(message)) {
    return false;
  }

  return true;
}

function resolveMaxTriggerTokens(configured: number | undefined): number {
  if (configured === undefined || !Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_TRIGGER_TOKENS;
  }

  return Math.floor(configured);
}

export function buildCompactionPlan<TMessage extends CompactionPlanMessage>(
  messages: TMessage[],
  config: CompactionWindowConfig = {},
): CompactionPlan<TMessage> {
  const mode = config.mode ?? "auto";
  const contextWindow = config.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const triggerRatio = config.triggerRatio ?? DEFAULT_TRIGGER_RATIO;
  const maxTriggerTokens = resolveMaxTriggerTokens(config.maxTriggerTokens);
  const keepRecentMessages = config.keepRecentMessages ?? DEFAULT_KEEP_RECENT_MESSAGES;
  const maxSummaryCharacters = config.maxSummaryCharacters ?? DEFAULT_MAX_SUMMARY_CHARACTERS;

  if (mode === "off") {
    return {
      shouldCompact: false,
      messagesToArchive: [],
      messagesToKeep: messages,
      snapshotInsertionIndex: messages.length,
      candidateMessageCount: 0,
      summaryInput: "",
    };
  }

  if (mode === "auto") {
    const estimatedTokens = estimateConversationTokens(
      messages.filter(countsTowardCompactionPressure),
    );
    const compactionThreshold = Math.min(
      Math.floor(contextWindow * triggerRatio),
      maxTriggerTokens,
    );

    if (estimatedTokens < compactionThreshold) {
      return {
        shouldCompact: false,
        messagesToArchive: [],
        messagesToKeep: messages,
        snapshotInsertionIndex: messages.length,
        candidateMessageCount: 0,
        summaryInput: "",
      };
    }
  }

  if (mode !== "auto" && mode !== "manual") {
    return {
      shouldCompact: false,
      messagesToArchive: [],
      messagesToKeep: messages,
      snapshotInsertionIndex: messages.length,
      candidateMessageCount: 0,
      summaryInput: "",
    };
  }

  const archiveBoundary =
    mode === "manual"
      ? messages.length
      : messages.length > keepRecentMessages
        ? messages.length - keepRecentMessages
        : Math.max(messages.length - 1, 0);
  const archiveableHead = messages.slice(0, archiveBoundary);
  const tail = messages.slice(archiveBoundary);

  const candidateMessages = archiveableHead.filter(canArchiveDuringCompaction);

  if (candidateMessages.length === 0) {
    return {
      shouldCompact: false,
      messagesToArchive: [],
      messagesToKeep: messages,
      snapshotInsertionIndex: messages.length,
      candidateMessageCount: 0,
      summaryInput: "",
    };
  }

  const summarySelection = selectMessagesForSummary(candidateMessages, maxSummaryCharacters);

  if (summarySelection.representedMessages.length === 0) {
    return {
      shouldCompact: false,
      messagesToArchive: [],
      messagesToKeep: messages,
      snapshotInsertionIndex: messages.length,
      candidateMessageCount: candidateMessages.length,
      summaryInput: "",
    };
  }

  const preservedHead = archiveableHead.filter((message) => !canArchiveDuringCompaction(message));
  const messagesToKeep = [...preservedHead, ...summarySelection.unrepresentedMessages, ...tail];

  return {
    shouldCompact: true,
    messagesToArchive: summarySelection.representedMessages,
    messagesToKeep,
    snapshotInsertionIndex: preservedHead.length,
    candidateMessageCount: candidateMessages.length,
    summaryInput: summarySelection.input,
  };
}

const ROLE_LABELS: Partial<Record<Message["role"], string>> = {
  user: "[User]",
  assistant: "[Assistant]",
  tool: "[Tool result]",
  system: "[System]",
  developer: "[Developer]",
};

export interface SummaryInputSelection<TMessage extends CompactionPlanMessage = Message> {
  input: string;
  representedMessages: TMessage[];
  unrepresentedMessages: TMessage[];
}

function formatMessageForSummary(message: CompactionPlanMessage): string | null {
  const label = ROLE_LABELS[message.role] ?? `[${message.role}]`;
  const body = messageToText(message, { truncateToolResults: false });

  if (!body) {
    return null;
  }

  const prefix = message.role === "tool" && message.name ? `${label}(${message.name})` : label;

  return `${prefix}: ${body}`;
}

export function selectMessagesForSummary<TMessage extends CompactionPlanMessage>(
  messages: TMessage[],
  maxCharacters = DEFAULT_MAX_SUMMARY_CHARACTERS,
): SummaryInputSelection<TMessage> {
  const lines: string[] = [];
  let representedCount = 0;
  let inputLength = 0;

  if (!Number.isFinite(maxCharacters) || maxCharacters <= 0) {
    return {
      input: "",
      representedMessages: [],
      unrepresentedMessages: messages,
    };
  }

  for (const message of messages) {
    const line = formatMessageForSummary(message);
    const separatorLength = lines.length > 0 ? 1 : 0;

    if (!line || inputLength + separatorLength + line.length > maxCharacters) {
      break;
    }

    lines.push(line);
    inputLength += separatorLength + line.length;
    representedCount += 1;
  }

  return {
    input: lines.join("\n"),
    representedMessages: messages.slice(0, representedCount),
    unrepresentedMessages: messages.slice(representedCount),
  };
}

export function buildFallbackSummary(messages: Message[]): string {
  const transcript = formatMessagesForSummary(messages);

  if (!transcript) {
    return "Conversation snapshot recorded.";
  }

  return `Earlier context transcript:\n${transcript}`;
}

export function formatMessagesForSummary(
  messages: Message[],
  maxCharacters = DEFAULT_MAX_SUMMARY_CHARACTERS,
): string {
  return selectMessagesForSummary(messages, maxCharacters).input;
}
