import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { UsageChargeAdjustmentReason } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type {
  RunChargeAdjustment,
  RunChargeGroup,
  RunChargeState,
  UsageEventRecord,
  UsageRuntime,
} from "./store.js";

const logger = getLogger({ prefix: "ai-billing/run-charge" });

const MAX_RECONCILE_ATTEMPTS = 3;

interface RunChargeTarget {
  creditMicros: number;
  reason: UsageChargeAdjustmentReason;
}

export function resolveRunChargeTarget(
  state: Pick<RunChargeState, "capCreditMicros" | "refunded" | "delegatedCreditMicros">,
): RunChargeTarget | null {
  if (state.refunded) {
    return { creditMicros: 0, reason: "platform_failure_refund" };
  }

  return state.capCreditMicros
    ? {
        creditMicros: Math.max(0, state.capCreditMicros - state.delegatedCreditMicros),
        reason: "run_cap_absorbed",
      }
    : null;
}

export function runCapRemainingCreditMicros(state: RunChargeState | null): number | null {
  return state?.capCreditMicros
    ? Math.max(0, state.capCreditMicros - state.chargedCreditMicros - state.delegatedCreditMicros)
    : null;
}

export function planRunChargeAdjustments(
  groups: readonly RunChargeGroup[],
  target: RunChargeTarget,
): RunChargeAdjustment[] {
  const charged = groups.reduce((total, group) => total + group.credit_micros, 0);
  let excess = charged - target.creditMicros;
  const adjustments: RunChargeAdjustment[] = [];
  const newestFirst = [...groups].sort(
    (left, right) =>
      right.period.localeCompare(left.period) || right.credit_micros - left.credit_micros,
  );

  for (const group of newestFirst) {
    if (excess <= 0) {
      break;
    }

    const creditMicros = Math.min(group.credit_micros, excess);

    if (creditMicros > 0) {
      adjustments.push({ group, creditMicros, reason: target.reason });
      excess -= creditMicros;
    }
  }

  return adjustments;
}

function buildAdjustmentEvent(
  runId: string,
  adjustment: RunChargeAdjustment,
  occurredAt: string,
): UsageEventRecord {
  const { group, creditMicros, reason } = adjustment;
  const id = generateId();

  return {
    id,
    idempotency_key: `run_charge:${runId}:${id}`,
    user_id: group.user_id,
    workspace_id: group.workspace_id,
    pool_workspace_id: group.pool_workspace_id,
    project_id: group.project_id,
    conversation_id: group.conversation_id,
    message_id: null,
    activity_id: null,
    completion_id: null,
    run_id: runId,
    run_attempt: group.run_attempt,
    occurred_at: occurredAt,
    period: group.period,
    source: group.source,
    vendor: group.vendor,
    resource: group.resource,
    unit: group.unit,
    quantity: 0,
    rate_version: null,
    unit_cost_micros: null,
    cost_micros: 0,
    credit_micros: -creditMicros,
    billable: true,
    byok: false,
    estimated: false,
    vendor_units: null,
    reason,
    site: null,
    raw: null,
  };
}

export async function reconcileRunCharge(runtime: UsageRuntime, runId: string): Promise<void> {
  const { store, publisher } = runtime;

  try {
    for (let attempt = 0; attempt < MAX_RECONCILE_ATTEMPTS; attempt += 1) {
      const state = await store.getRunChargeState(runId);
      const target = state ? resolveRunChargeTarget(state) : null;

      if (!state || !target || state.chargedCreditMicros <= target.creditMicros) {
        return;
      }

      const groups = await store.listRunChargeGroups(runId);
      const occurredAt = new Date().toISOString();
      const adjustments = planRunChargeAdjustments(groups, target);
      const applied = await store.applyRunChargeAdjustments(
        runId,
        state.chargedCreditMicros,
        adjustments.map((adjustment) => buildAdjustmentEvent(runId, adjustment, occurredAt)),
      );

      if (applied) {
        for (const { group } of adjustments) {
          await publisher?.usageChanged(group.user_id, group.period);

          if (group.pool_workspace_id) {
            await publisher?.workspaceUsageChanged?.(group.pool_workspace_id, group.period);
          }
        }

        return;
      }
    }

    logger.warn("Run charge kept changing while it was being reconciled", { runId });
  } catch (error) {
    logger.error("Failed to reconcile a run charge", { error, runId });
  }
}
