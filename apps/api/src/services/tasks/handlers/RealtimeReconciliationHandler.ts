import { rateEntriesFromModelConfig } from "@ngriffin_uk/polychat-schemas";

import { getModelConfig } from "~/lib/providers/models";
import { emitUsageEvents, type UsageEventDraft } from "~/lib/usage/ledger";
import { finishUsageReservation } from "~/lib/usage/reservations";
import { RepositoryManager } from "~/repositories";
import type { RealtimeReconciliationPayload } from "~/services/realtime/sessionUsage";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/realtime-reconciliation" });

function parsePayload(value: unknown): RealtimeReconciliationPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const pricing = value.pricing;

  if (
    typeof value.sessionId !== "string" ||
    typeof value.userId !== "number" ||
    typeof value.model !== "string" ||
    typeof value.provider !== "string" ||
    !isRecord(pricing) ||
    typeof pricing.unit !== "string" ||
    typeof pricing.quantity !== "number" ||
    typeof pricing.vendor !== "string" ||
    typeof pricing.resource !== "string"
  ) {
    return null;
  }

  return value as unknown as RealtimeReconciliationPayload;
}

export class RealtimeReconciliationHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = parsePayload(message.task_data);

    if (!payload) {
      return { status: "skipped", message: "Invalid realtime reconciliation payload" };
    }

    try {
      const repositories = new RepositoryManager(env);
      const reservation = await finishUsageReservation({
        repositories,
        kind: "realtime",
        refId: payload.sessionId,
        outcome: "settled",
      });

      if (!reservation) {
        return {
          status: "success",
          message: "Realtime reservation was already settled or never held",
        };
      }

      const modelConfig = await getModelConfig(payload.model, env);
      const rates = modelConfig
        ? rateEntriesFromModelConfig(modelConfig, { resource: payload.pricing.resource })
        : [];

      const draft: UsageEventDraft = {
        idempotencyKey: `realtime:${payload.sessionId}:settlement`,
        userId: payload.userId,
        source: "capability",
        vendor: payload.pricing.vendor,
        resource: payload.pricing.resource,
        unit: payload.pricing.unit,
        quantity: payload.pricing.quantity,
        byok: payload.byok === true,
        completionId: payload.sessionId,
        rates,
        raw: { sessionId: payload.sessionId, provider: payload.provider },
      };

      await emitUsageEvents({ env, repositories, drafts: [draft] });

      return {
        status: "success",
        message: `Settled realtime session ${payload.sessionId}`,
        data: { unit: payload.pricing.unit, quantity: payload.pricing.quantity },
      };
    } catch (error) {
      logger.error("Failed to reconcile a realtime session", {
        error,
        sessionId: payload.sessionId,
      });

      return { status: "error", message: (error as Error).message };
    }
  }
}
