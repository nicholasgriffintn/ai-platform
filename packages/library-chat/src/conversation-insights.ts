import type { Message } from "./conversation-types.js";
import { formattedMessageContent } from "./messages.js";
import { estimateUsageCost, readTokenUsageCounts, type ModelPricing } from "./response-stats.js";

export interface ConversationUsageSummary {
  replies: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
  latestInputTokens?: number;
  latestModel?: string;
  latestProvider?: string;
}

export interface ConversationArtifactSummary {
  identifier: string;
  type: string;
  language: string;
  title?: string;
  content: string;
  messageId: string;
  revisions: number;
}

export function summariseConversationUsage(
  messages: readonly Message[],
  pricingFor: (model: string | undefined) => ModelPricing | undefined = () => undefined,
): ConversationUsageSummary {
  const summary: ConversationUsageSummary = { replies: 0, inputTokens: 0, outputTokens: 0 };

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    summary.replies += 1;

    if (message.model) {
      summary.latestModel = message.model;
      summary.latestProvider = message.provider;
    }

    const usage = readTokenUsageCounts(message.usage);

    if (!usage) {
      continue;
    }

    summary.inputTokens += usage.inputTokens ?? 0;
    summary.outputTokens += usage.outputTokens ?? 0;

    if (usage.inputTokens !== undefined) {
      summary.latestInputTokens = usage.inputTokens;
    }

    const cost = estimateUsageCost(usage, pricingFor(message.model));

    if (cost !== undefined) {
      summary.estimatedCostUsd = (summary.estimatedCostUsd ?? 0) + cost;
    }
  }

  return summary;
}

export function listConversationArtifacts(
  messages: readonly Message[],
): ConversationArtifactSummary[] {
  const artifacts = new Map<string, ConversationArtifactSummary>();

  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.content !== "string") {
      continue;
    }

    for (const artifact of formattedMessageContent("assistant", message.content).artifacts) {
      if (artifact.isOpen) {
        continue;
      }

      const previous = artifacts.get(artifact.identifier);

      artifacts.delete(artifact.identifier);
      artifacts.set(artifact.identifier, {
        identifier: artifact.identifier,
        type: artifact.type,
        language: artifact.language,
        title: artifact.title ?? previous?.title,
        content: artifact.content,
        messageId: message.id,
        revisions: (previous?.revisions ?? 0) + 1,
      });
    }
  }

  return [...artifacts.values()].reverse();
}
