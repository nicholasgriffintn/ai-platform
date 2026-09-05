import {
  compactionStatusLabels,
  type CompactionCoverage,
  type CompactionSummaryStrategy,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { getSummarisePrompt } from "~/lib/prompts/summarise";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { ChatMode, IEnv, Message, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import {
  buildCompactionPlan,
  buildFallbackSummary,
  type CompactionMode,
  selectMessagesForSummary,
} from "./compaction";

const logger = getLogger({ prefix: "lib/session/SessionManager" });

export interface SessionConversationStore {
  persistCompaction(
    conversationId: string,
    snapshotMessage: Message,
    compactionMessage: Message,
    messageIdsToArchive: string[],
  ): Promise<void>;
}

interface SessionManagerConfig {
  env: IEnv;
  conversationManager: SessionConversationStore;
  user?: IUser;
}

export interface CompactSessionInput {
  completionId: string;
  messages: Message[];
  compaction?: CompactionMode;
  mode?: ChatMode;
  modelConfig?: {
    contextWindow?: number;
  };
}

export interface CompactSessionResult {
  messages: Message[];
  compacted: boolean;
  snapshotMessage?: Message;
  compactionMessage?: Message;
}

interface SessionSummaryResult {
  summary: string;
  strategy: CompactionSummaryStrategy;
}

export class SessionManager {
  private env: IEnv;
  private conversationManager: SessionConversationStore;
  private user?: IUser;

  constructor(config: SessionManagerConfig) {
    this.env = config.env;
    this.conversationManager = config.conversationManager;
    this.user = config.user;
  }

  public async compact(input: CompactSessionInput): Promise<CompactSessionResult> {
    const plan = buildCompactionPlan(input.messages, {
      mode: input.compaction,
      contextWindow: input.modelConfig?.contextWindow,
    });

    if (!plan.shouldCompact) {
      return {
        messages: input.messages,
        compacted: false,
      };
    }

    const summaryResult = await this.createSummary(
      plan.summaryInput,
      plan.messagesToArchive,
      input.mode,
    );
    const coverage: CompactionCoverage = {
      coveredMessageIds: plan.messagesToArchive.flatMap((message) =>
        typeof message.id === "string" && message.id.length > 0 ? [message.id] : [],
      ),
      coveredMessageCount: plan.messagesToArchive.length,
      candidateMessageCount: plan.candidateMessageCount,
      summaryInputCharacters: plan.summaryInput.length,
      strategy: summaryResult.strategy,
    };
    const snapshotMessage = this.snapshot(
      summaryResult.summary,
      input.mode || plan.messagesToArchive.at(-1)?.mode,
      this.getSnapshotTimestamp(plan.messagesToKeep[plan.snapshotInsertionIndex]),
      coverage,
    );
    const compactionMessage = this.compactionMarker({
      completionId: input.completionId,
      snapshotMessage,
      compaction: input.compaction ?? "auto",
      mode: input.mode || plan.messagesToArchive.at(-1)?.mode,
      coverage,
    });

    await this.persistCompaction(input.completionId, snapshotMessage, compactionMessage, coverage);

    const compactedMessages = [...plan.messagesToKeep];

    compactedMessages.splice(plan.snapshotInsertionIndex, 0, snapshotMessage);

    return {
      messages: compactedMessages,
      compacted: true,
      snapshotMessage,
      compactionMessage,
    };
  }

  public async summarise(messages: Message[], mode?: ChatMode): Promise<string> {
    if (messages.length === 0) {
      return "Conversation snapshot recorded.";
    }

    const selection = selectMessagesForSummary(messages);

    if (!selection.input) {
      return "Conversation snapshot recorded.";
    }

    return (await this.createSummary(selection.input, selection.representedMessages, mode)).summary;
  }

  private async createSummary(
    summaryInput: string,
    representedMessages: Message[],
    mode?: ChatMode,
  ): Promise<SessionSummaryResult> {
    try {
      const { model, provider } = await getAuxiliaryModel(this.env, this.user);
      const chatProvider = getChatProvider(provider, {
        env: this.env,
        user: this.user,
      });

      const modeHint = mode ? `The conversation was in "${mode}" mode.` : "";

      const response = await chatProvider.getResponse({
        env: this.env,
        context: createServiceContext({ env: this.env, user: this.user }),
        model,
        messages: [
          {
            role: "system",
            content: getSummarisePrompt({ modeHint }),
          },
          {
            role: "user",
            content: summaryInput,
          },
        ],
      });

      if (typeof response?.response === "string" && response.response.trim()) {
        return {
          summary: response.response.trim(),
          strategy: "model_summary",
        };
      }
    } catch (error) {
      logger.warn("Failed to summarise archived messages", {
        error,
        count: representedMessages.length,
      });
    }

    return {
      summary: buildFallbackSummary(representedMessages),
      strategy: "fallback_transcript",
    };
  }

  public snapshot(
    summary: string,
    mode?: ChatMode,
    timestamp = Date.now(),
    coverage?: CompactionCoverage,
  ): Message {
    return {
      id: generateId(),
      role: "assistant",
      content: `Conversation snapshot\n\n${summary}`,
      parts: [
        {
          type: "snapshot",
          title: "Conversation snapshot",
          summary,
          timestamp,
          coverage,
        },
        {
          type: "text",
          text: `Conversation snapshot\n\n${summary}`,
          timestamp,
        },
      ],
      mode,
      timestamp,
    };
  }

  public compactionMarker({
    completionId,
    snapshotMessage,
    compaction,
    mode,
    coverage,
  }: {
    completionId: string;
    snapshotMessage: Message;
    compaction: CompactionMode;
    mode?: ChatMode;
    coverage?: CompactionCoverage;
  }): Message {
    const label =
      compaction === "manual"
        ? compactionStatusLabels.manualCompleted
        : compactionStatusLabels.automaticCompleted;
    const timestamp =
      typeof snapshotMessage.timestamp === "number" ? snapshotMessage.timestamp : Date.now();

    return {
      id: `${snapshotMessage.id}-compaction`,
      completion_id: completionId,
      role: "compaction",
      content: label,
      parts: [
        {
          type: "compaction",
          status: "completed",
          label,
          timestamp,
          coverage,
        },
      ],
      mode,
      timestamp,
    };
  }

  private getSnapshotTimestamp(nextMessage?: Message): number {
    const nextTimestamp = nextMessage?.timestamp;

    if (typeof nextTimestamp !== "number" || !Number.isFinite(nextTimestamp)) {
      return Date.now();
    }

    return Math.max(0, nextTimestamp - 1);
  }

  private async persistCompaction(
    completionId: string,
    snapshotMessage: Message,
    compactionMessage: Message,
    coverage: CompactionCoverage,
  ): Promise<void> {
    const archiveIds = coverage.coveredMessageIds;

    try {
      await this.conversationManager.persistCompaction(
        completionId,
        snapshotMessage,
        compactionMessage,
        [...archiveIds, compactionMessage.id],
      );
    } catch (error) {
      logger.warn("Failed to persist session compaction", {
        error,
        completionId,
        archivedCount: archiveIds.length,
      });
      throw error;
    }
  }
}
