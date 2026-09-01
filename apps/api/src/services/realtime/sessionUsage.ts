import {
  REALTIME_RECONCILIATION_TASK_TYPE,
  modelRateResource,
  priceUsage,
  rateEntriesFromModelConfig,
  creditMicrosFromCostMicros,
  usagePeriodFromDate,
  type ModelConfigItem,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";

import {
  REALTIME_RECONCILIATION_BUFFER_SECONDS,
  REALTIME_RESERVATION_SECONDS,
} from "~/lib/realtime/sessionLimits";
import { holdUsageReservation } from "~/lib/usage/reservations";
import type { RepositoryManager } from "~/repositories";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/realtime/session-usage" });

export interface RealtimeReservationPricing {
  vendor: string;
  resource: string;
  unit: UsageUnit;
  quantity: number;
  creditMicros: number;
}

export interface RealtimeReconciliationPayload {
  sessionId: string;
  userId: number;
  model: string;
  provider: string;
  byok: boolean;
  pricing: RealtimeReservationPricing;
}

export function priceRealtimeReservation(
  modelConfig: ModelConfigItem | undefined,
  provider: string,
  model: string,
): RealtimeReservationPricing {
  const occurredAt = new Date().toISOString();
  const vendor = modelConfig?.provider ?? provider;
  const resource = modelConfig ? modelRateResource(modelConfig) : model;
  const rates = modelConfig ? rateEntriesFromModelConfig(modelConfig, { resource }) : [];

  const audioPriced = priceUsage(
    rates,
    { vendor, resource, unit: "audio_seconds", occurredAt },
    REALTIME_RESERVATION_SECONDS,
  );

  if (!audioPriced.estimated) {
    return {
      vendor,
      resource,
      unit: "audio_seconds",
      quantity: REALTIME_RESERVATION_SECONDS,
      creditMicros: creditMicrosFromCostMicros(Math.round(audioPriced.costMicros)),
    };
  }

  const requestPriced = priceUsage(rates, { vendor, resource, unit: "requests", occurredAt }, 1);

  return {
    vendor,
    resource,
    unit: "requests",
    quantity: 1,
    creditMicros: creditMicrosFromCostMicros(Math.round(requestPriced.costMicros)),
  };
}

export async function admitRealtimeSession(params: {
  repositories: RepositoryManager | null;
  userId: number;
  creditMicros: number;
}): Promise<boolean> {
  if (!params.repositories) {
    return true;
  }

  try {
    const period = usagePeriodFromDate();
    const balance = await params.repositories.usageBalances.getBalance(params.userId, period);

    if (!balance || balance.included_credit_micros <= 0) {
      return true;
    }

    if (balance.overage_enabled) {
      return true;
    }

    const committed = balance.spent_credit_micros + balance.reserved_credit_micros;
    const ceiling = balance.included_credit_micros + balance.grace_credit_micros;

    return committed + params.creditMicros <= ceiling;
  } catch (error) {
    logger.warn("Failed to evaluate realtime admission, admitting the session", {
      error,
      userId: params.userId,
    });

    return true;
  }
}

export async function registerRealtimeSessionUsage(params: {
  env: IEnv;
  repositories: RepositoryManager | null;
  userId: number;
  sessionId: string;
  model: string;
  provider: string;
  byok: boolean;
  pricing: RealtimeReservationPricing;
  maxSessionSeconds: number;
}): Promise<void> {
  const repositories = params.repositories;

  if (!repositories) {
    return;
  }

  const reconcileDelaySeconds = params.maxSessionSeconds + REALTIME_RECONCILIATION_BUFFER_SECONDS;
  const reconcileAt = new Date(Date.now() + reconcileDelaySeconds * 1000).toISOString();

  try {
    await holdUsageReservation({
      repositories,
      userId: params.userId,
      kind: "realtime",
      refId: params.sessionId,
      creditMicros: params.pricing.creditMicros,
      expiresAt: reconcileAt,
    });
  } catch (error) {
    logger.error("Failed to hold a realtime session reservation", {
      error,
      sessionId: params.sessionId,
      userId: params.userId,
    });
  }

  try {
    const taskService = new TaskService(params.env, repositories.tasks);

    await taskService.enqueueTask({
      task_type: REALTIME_RECONCILIATION_TASK_TYPE,
      user_id: params.userId,
      schedule_type: "scheduled",
      scheduled_at: reconcileAt,
      task_data: {
        sessionId: params.sessionId,
        userId: params.userId,
        model: params.model,
        provider: params.provider,
        byok: params.byok,
        pricing: params.pricing,
      } satisfies RealtimeReconciliationPayload,
      priority: 3,
    });
  } catch (error) {
    logger.error("Failed to enqueue a realtime reconciliation task", {
      error,
      sessionId: params.sessionId,
      userId: params.userId,
    });
  }
}
