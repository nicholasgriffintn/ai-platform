import type { AiGenerationSignal, TelemetrySpan, TelemetrySpanStatus } from "./types.js";
import { normaliseTokenUsage } from "./usage/token-usage.js";

export const GEN_AI_CHAT_OPERATION = "chat";
export const GEN_AI_INVOKE_AGENT_OPERATION = "invoke_agent";

export function chatRunSpanId(runId: string): string {
  return `run:${runId}`;
}

export function buildGenAiGenerationSpan(
  signal: AiGenerationSignal,
  endTime: number,
): TelemetrySpan {
  const usage = normaliseTokenUsage(signal.usage);
  const model = signal.model || "unknown";

  return {
    traceId: signal.traceId,
    spanId: signal.spanId ?? `${signal.traceId}:${model}:${endTime}`,
    ...(signal.parentSpanId ? { parentSpanId: signal.parentSpanId } : {}),
    name: `${GEN_AI_CHAT_OPERATION} ${model}`,
    startTime: endTime - Math.max(0, signal.latencyMs ?? 0),
    endTime,
    status: signal.error ? "error" : "ok",
    ...(signal.error?.message ? { statusMessage: signal.error.message } : {}),
    attributes: {
      "gen_ai.operation.name": GEN_AI_CHAT_OPERATION,
      "gen_ai.provider.name": signal.provider || "unknown",
      "gen_ai.request.model": model,
      "gen_ai.conversation.id": signal.sessionId,
      "gen_ai.request.temperature": signal.temperature,
      "gen_ai.request.max_tokens": signal.maxTokens,
      "gen_ai.response.finish_reasons": signal.stopReason ? [signal.stopReason] : undefined,
      "gen_ai.usage.input_tokens": usage?.input_tokens,
      "gen_ai.usage.output_tokens": usage?.output_tokens,
      "gen_ai.usage.cache_read.input_tokens": usage?.cached_input_tokens,
      "gen_ai.usage.reasoning.output_tokens": usage?.reasoning_tokens,
      "gen_ai.server.time_to_first_token":
        signal.timeToFirstTokenMs === undefined ? undefined : signal.timeToFirstTokenMs / 1000,
      "gen_ai.tool.names": signal.toolsCalled?.length ? signal.toolsCalled : undefined,
      "http.response.status_code": signal.httpStatus,
      "error.type": signal.error
        ? signal.error.httpStatus
          ? String(signal.error.httpStatus)
          : "error"
        : undefined,
    },
  };
}

export interface ChatRunSpanInput {
  runId: string;
  conversationId: string;
  status: string;
  trigger: string;
  startedAt: number;
  endedAt: number;
  agentId?: string | null;
  projectId?: string | null;
  recipeInstallationId?: string | null;
  terminalReason?: string | null;
}

const FAILED_RUN_STATUSES = new Set(["failed", "interrupted"]);

export function buildChatRunSpan(input: ChatRunSpanInput): TelemetrySpan {
  const status: TelemetrySpanStatus = FAILED_RUN_STATUSES.has(input.status) ? "error" : "ok";

  return {
    traceId: input.runId,
    spanId: chatRunSpanId(input.runId),
    name: `${GEN_AI_INVOKE_AGENT_OPERATION} ${input.agentId ?? "assistant"}`,
    startTime: input.startedAt,
    endTime: Math.max(input.startedAt, input.endedAt),
    status,
    ...(status === "error" && input.terminalReason ? { statusMessage: input.terminalReason } : {}),
    attributes: {
      "gen_ai.operation.name": GEN_AI_INVOKE_AGENT_OPERATION,
      "gen_ai.conversation.id": input.conversationId,
      "gen_ai.agent.id": input.agentId ?? undefined,
      "polychat.run.id": input.runId,
      "polychat.run.status": input.status,
      "polychat.run.trigger": input.trigger,
      "polychat.project.id": input.projectId ?? undefined,
      "polychat.recipe_installation.id": input.recipeInstallationId ?? undefined,
    },
  };
}
