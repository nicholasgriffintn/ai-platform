import { resolveSpendState } from "@ngriffin_uk/polychat-ai-billing";
import {
  usagePeriodFromDate,
  usagePeriodResetsAt,
  type SpendLedger,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";

export interface SpendLedgerQuery {
  period?: string;
  teammateContextId?: string;
  recipeInstallationId?: string;
  capCreditMicros: number | null;
}

export async function readSpendLedger(
  context: ServiceContext,
  query: SpendLedgerQuery,
): Promise<SpendLedger> {
  const period = query.period ?? usagePeriodFromDate();
  const summary = await context.repositories.get(UsageEventRepository).summariseRunSpend({
    period,
    ...(query.teammateContextId ? { teammateContextId: query.teammateContextId } : {}),
    ...(query.recipeInstallationId ? { recipeInstallationId: query.recipeInstallationId } : {}),
  });
  const creditMicros = Math.max(0, Math.round(summary.credit_micros));

  return {
    period,
    creditMicros,
    costMicros: Math.max(0, Math.round(summary.cost_micros)),
    runCount: Math.max(0, Math.round(summary.run_count)),
    capCreditMicros: query.capCreditMicros,
    state: resolveSpendState(creditMicros, query.capCreditMicros),
    resetsAt: usagePeriodResetsAt(period),
  };
}
