import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types";

export interface StreamActivityTool {
  id: string;
  name: string;
  startedAt: number;
  completedAt?: number;
}

export interface TokenUsageCounts {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface StreamActivity {
  startedAt: number;
  contentChars: number;
  reasoningChars: number;
  tools: StreamActivityTool[];
  usage?: TokenUsageCounts;
}

export interface ModelPricing {
  costPer1kInputTokens?: number;
  costPer1kOutputTokens?: number;
}

export interface MessageStats {
  durationMs?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  toolCount?: number;
  estimatedCostUsd?: number;
}

const CHARS_PER_TOKEN = 4;

const INPUT_TOKEN_FIELDS = ["prompt_tokens", "input_tokens", "promptTokenCount"];
const OUTPUT_TOKEN_FIELDS = ["completion_tokens", "output_tokens", "candidatesTokenCount"];
const TOTAL_TOKEN_FIELDS = ["total_tokens", "totalTokenCount"];

export function createStreamActivity(startedAt: number): StreamActivity {
  return {
    startedAt,
    contentChars: 0,
    reasoningChars: 0,
    tools: [],
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function readField(source: Record<string, unknown>, fields: string[]): number | undefined {
  for (const field of fields) {
    const value = readTokenCount(source[field]);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export function readTokenUsageCounts(value: unknown): TokenUsageCounts | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const source = isRecord(value.usage) ? value.usage : value;
  const inputTokens = readField(source, INPUT_TOKEN_FIELDS);
  const outputTokens = readField(source, OUTPUT_TOKEN_FIELDS);
  const totalTokens =
    readField(source, TOTAL_TOKEN_FIELDS) ??
    (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined);

  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  return { inputTokens, outputTokens, totalTokens };
}

function completeRunningTools(activity: StreamActivity, completedAt: number): StreamActivity {
  if (!activity.tools.some((tool) => tool.completedAt === undefined)) {
    return activity;
  }

  return {
    ...activity,
    tools: activity.tools.map((tool) =>
      tool.completedAt === undefined ? { ...tool, completedAt } : tool,
    ),
  };
}

export function applyStreamActivityState(
  activity: StreamActivity,
  state: string,
  data: unknown,
  now: number,
): StreamActivity {
  if (state === "usage") {
    const usage = readTokenUsageCounts(data);

    return usage ? { ...activity, usage } : activity;
  }

  if (state === "post_processing") {
    return completeRunningTools(activity, now);
  }

  if (state !== "tool_use_start") {
    return activity;
  }

  const name = readString(isRecord(data) ? data.tool_name : undefined) ?? "tool";
  const id = readString(isRecord(data) ? data.tool_id : undefined) ?? `${name}-${now}`;

  if (activity.tools.some((tool) => tool.id === id)) {
    return activity;
  }

  return {
    ...activity,
    tools: [...activity.tools, { id, name, startedAt: now }],
  };
}

export function completeStreamActivityTool(
  activity: StreamActivity,
  toolResult: { toolCallId?: string; name?: string },
  now: number,
): StreamActivity {
  const running = activity.tools.filter((tool) => tool.completedAt === undefined);

  if (running.length === 0) {
    return activity;
  }

  const match =
    running.find((tool) => Boolean(toolResult.toolCallId) && tool.id === toolResult.toolCallId) ??
    running.find((tool) => Boolean(toolResult.name) && tool.name === toolResult.name) ??
    running[0];

  return {
    ...activity,
    tools: activity.tools.map((tool) =>
      tool.id === match.id ? { ...tool, completedAt: now } : tool,
    ),
  };
}

export function applyStreamActivityText(
  activity: StreamActivity,
  text: { content?: unknown; reasoning?: unknown },
): StreamActivity {
  const contentChars =
    typeof text.content === "string" ? text.content.length : activity.contentChars;
  const reasoningChars =
    typeof text.reasoning === "string" ? text.reasoning.length : activity.reasoningChars;

  if (contentChars === activity.contentChars && reasoningChars === activity.reasoningChars) {
    return activity;
  }

  return {
    ...activity,
    contentChars: Math.max(contentChars, activity.contentChars),
    reasoningChars: Math.max(reasoningChars, activity.reasoningChars),
  };
}

export function getRunningStreamActivityTools(activity: StreamActivity): StreamActivityTool[] {
  return activity.tools.filter((tool) => tool.completedAt === undefined);
}

export function estimateStreamActivityTokens(activity: StreamActivity): number {
  const chars = activity.contentChars + activity.reasoningChars;

  return chars === 0 ? 0 : Math.max(1, Math.round(chars / CHARS_PER_TOKEN));
}

export function formatStatsDuration(durationMs: number): string {
  const safeDuration = Math.max(0, durationMs);
  const totalSeconds = Math.floor(safeDuration / 1000);

  if (totalSeconds < 60) {
    return safeDuration < 10_000 && safeDuration > 0
      ? `${(safeDuration / 1000).toFixed(1)}s`
      : `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatStatsTokens(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens}`;
  }

  if (tokens < 1_000_000) {
    const thousands = tokens / 1000;

    return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`;
  }

  return `${(tokens / 1_000_000).toFixed(1)}m`;
}

export function formatStatsCost(costUsd: number): string {
  return `$${costUsd.toFixed(costUsd >= 1 ? 2 : costUsd >= 0.01 ? 3 : 4)}`;
}

function formatToolCount(count: number): string {
  return `${count} ${count === 1 ? "tool" : "tools"}`;
}

export function getStreamActivityMetrics(activity: StreamActivity, now: number): string[] {
  const metrics = [formatStatsDuration(now - activity.startedAt)];
  const inputTokens = activity.usage?.inputTokens;
  const outputTokens = activity.usage?.outputTokens;

  if (inputTokens) {
    metrics.push(`${formatStatsTokens(inputTokens)} in`);
  }

  if (outputTokens) {
    metrics.push(`${formatStatsTokens(outputTokens)} out`);
  } else {
    const estimatedTokens = estimateStreamActivityTokens(activity);

    if (estimatedTokens > 0) {
      metrics.push(`~${formatStatsTokens(estimatedTokens)} out`);
    }
  }

  const running = getRunningStreamActivityTools(activity);

  if (running.length === 1) {
    metrics.push(`${running[0].name} running`);
  } else if (running.length > 1) {
    metrics.push(`${formatToolCount(running.length)} running`);
  } else if (activity.tools.length > 0) {
    metrics.push(formatToolCount(activity.tools.length));
  }

  return metrics;
}

export function estimateUsageCost(
  usage: TokenUsageCounts,
  pricing: ModelPricing | undefined,
): number | undefined {
  if (!pricing) {
    return undefined;
  }

  const inputCost =
    usage.inputTokens !== undefined && pricing.costPer1kInputTokens !== undefined
      ? (usage.inputTokens / 1000) * pricing.costPer1kInputTokens
      : 0;
  const outputCost =
    usage.outputTokens !== undefined && pricing.costPer1kOutputTokens !== undefined
      ? (usage.outputTokens / 1000) * pricing.costPer1kOutputTokens
      : 0;
  const cost = inputCost + outputCost;

  return cost > 0 ? cost : undefined;
}

export function getMessageStats(
  message: Message,
  options: { durationMs?: number; pricing?: ModelPricing } = {},
): MessageStats {
  const usage = readTokenUsageCounts(message.usage) ?? {};
  const toolCount = Array.isArray(message.tool_calls) ? message.tool_calls.length : 0;
  const durationMs = options.durationMs;

  return {
    durationMs:
      typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0
        ? durationMs
        : undefined,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    toolCount: toolCount > 0 ? toolCount : undefined,
    estimatedCostUsd: estimateUsageCost(usage, options.pricing),
  };
}

export function formatMessageStats(stats: MessageStats): string[] {
  const segments: string[] = [];

  if (stats.durationMs !== undefined) {
    segments.push(formatStatsDuration(stats.durationMs));
  }

  if (stats.totalTokens !== undefined) {
    segments.push(`${formatStatsTokens(stats.totalTokens)} tokens`);
  } else if (stats.outputTokens !== undefined) {
    segments.push(`${formatStatsTokens(stats.outputTokens)} out`);
  }

  if (stats.toolCount !== undefined) {
    segments.push(formatToolCount(stats.toolCount));
  }

  if (stats.estimatedCostUsd !== undefined) {
    segments.push(`~${formatStatsCost(stats.estimatedCostUsd)}`);
  }

  return segments;
}

export function getMessageStatsSegments(
  message: Message,
  options: { durationMs?: number; pricing?: ModelPricing } = {},
): string[] {
  return formatMessageStats(getMessageStats(message, options));
}
