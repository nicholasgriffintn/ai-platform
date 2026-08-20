import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Message, MessageUsage } from "./conversation-types";

export interface StreamActivityTool {
  id: string;
  name: string;
  startedAt: number;
  completedAt?: number;
}

export interface StreamActivity {
  startedAt: number;
  contentChars: number;
  reasoningChars: number;
  tools: StreamActivityTool[];
}

export interface MessageStats {
  durationMs?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  toolCount?: number;
  costUsd?: number;
}

const CHARS_PER_TOKEN = 4;

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

function formatToolCount(count: number): string {
  return `${count} ${count === 1 ? "tool" : "tools"}`;
}

export function getStreamActivityMetrics(activity: StreamActivity, now: number): string[] {
  const metrics = [formatStatsDuration(now - activity.startedAt)];
  const tokens = estimateStreamActivityTokens(activity);

  if (tokens > 0) {
    metrics.push(`~${formatStatsTokens(tokens)} tokens`);
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

function readUsageCost(usage: MessageUsage): number | undefined {
  const cost =
    usage.cost_usd ?? usage.costUsd ?? usage.estimated_cost_usd ?? usage.estimatedCostUsd;

  return typeof cost === "number" && Number.isFinite(cost) && cost > 0 ? cost : undefined;
}

function readTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function getMessageStats(message: Message, durationMs?: number): MessageStats {
  const usage = message.usage;
  const inputTokens = readTokenCount(usage?.prompt_tokens ?? usage?.promptTokenCount);
  const outputTokens = readTokenCount(usage?.completion_tokens ?? usage?.candidatesTokenCount);
  const totalTokens =
    readTokenCount(usage?.total_tokens ?? usage?.totalTokenCount) ??
    (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined);
  const toolCount = Array.isArray(message.tool_calls) ? message.tool_calls.length : 0;

  return {
    durationMs:
      typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0
        ? durationMs
        : undefined,
    inputTokens,
    outputTokens,
    totalTokens,
    toolCount: toolCount > 0 ? toolCount : undefined,
    costUsd: usage ? readUsageCost(usage) : undefined,
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

  if (stats.costUsd !== undefined) {
    segments.push(
      `$${stats.costUsd.toFixed(stats.costUsd >= 1 ? 2 : stats.costUsd >= 0.01 ? 3 : 4)}`,
    );
  }

  return segments;
}

export function getMessageStatsSegments(message: Message, durationMs?: number): string[] {
  return formatMessageStats(getMessageStats(message, durationMs));
}
