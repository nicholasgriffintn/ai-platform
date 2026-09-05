import { Monitoring } from "~/lib/monitoring";
import type { IEnv } from "~/types";

export type ChatRunOperationalSignal =
  | "duplicate_command"
  | "recovery"
  | "ownership_loss"
  | "approval_latency"
  | "cancellation_latency"
  | "uncertain_tool_outcome";

export interface ChatRunOperationalMetric {
  signal: ChatRunOperationalSignal;
  runId?: string;
  attempt?: number;
  taskId?: string;
  commandKind?: string;
  provider?: string;
  operation?: string;
  outcome: "success" | "interrupted" | "unknown";
  value?: number;
}

export function recordChatRunOperationalMetric(env: IEnv, metric: ChatRunOperationalMetric): void {
  const { signal, value = 1, outcome, ...metadata } = metric;

  try {
    Monitoring.getInstance(env).recordMetric({
      traceId: metric.runId ?? metric.taskId ?? "",
      timestamp: Date.now(),
      type: outcome === "unknown" ? "error" : "performance",
      name: `chat_run_${signal}`,
      value,
      metadata: { ...metadata, outcome },
      status: outcome === "success" ? "success" : outcome === "unknown" ? "error" : "info",
    });
  } catch {
    return;
  }
}
