import type { ExecutionContext } from "@cloudflare/workers-types";
import { buildChatRunSpan } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { parseTimestampMs } from "@ngriffin_uk/polychat-utility-core";

import { createTelemetry } from "~/infrastructure/telemetry";
import type { IEnv } from "~/types";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled", "interrupted"]);

export function recordChatRunTrace(env: IEnv, run: ChatRun, executionCtx?: ExecutionContext): void {
  if (!TERMINAL_STATUSES.has(run.status)) {
    return;
  }

  const startedAt = parseTimestampMs(run.startedAt) ?? parseTimestampMs(run.createdAt);
  const endedAt = parseTimestampMs(run.completedAt) ?? parseTimestampMs(run.updatedAt);

  if (startedAt === null || endedAt === null) {
    return;
  }

  createTelemetry(env, executionCtx).recordSpan(
    buildChatRunSpan({
      runId: run.id,
      conversationId: run.conversationId,
      status: run.status,
      trigger: run.trigger,
      startedAt,
      endedAt,
      agentId: run.teammateContextId,
      projectId: run.projectId,
      recipeInstallationId: run.recipeInstallationId,
      terminalReason: run.terminalReason,
    }),
  );
}
