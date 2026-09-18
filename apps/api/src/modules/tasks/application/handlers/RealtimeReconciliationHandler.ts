import {
  userCreditActor,
  emitUsageEvents,
  finishUsageReservation,
  type UsageEventDraft,
} from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { rateEntriesFromModelConfig } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { getModelConfig } from "~/modules/models/application/resolve";
import type { RealtimeReconciliationPayload } from "~/modules/realtime/application/sessionUsage";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

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
      const runtime = createUsageRuntime({ env });
      const reservation = await finishUsageReservation(runtime, {
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
        actor: userCreditActor(payload.userId),
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

      await emitUsageEvents(runtime, { drafts: [draft] });

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
