import type { ModelBudget, SpendPreflight } from "@ngriffin_uk/polychat-schemas";

export interface BudgetSpend {
  budget: ModelBudget;
  spentUsd: number;
  committedUsd: number;
}

export function monthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function preflightSpend(
  lines: readonly BudgetSpend[],
  estimateUsd: number | null,
): SpendPreflight {
  if (lines.length === 0) {
    return { decision: "allow", estimateUsd, remainingUsd: null, reason: null };
  }

  const estimate = estimateUsd ?? 0;
  let tightest: SpendPreflight = {
    decision: "allow",
    estimateUsd,
    remainingUsd: null,
    reason: null,
  };
  const rank = { allow: 0, warn: 1, needs_approval: 2, blocked: 3 } as const;

  for (const { budget, spentUsd, committedUsd } of lines) {
    const remaining = budget.monthlyLimitUsd - spentUsd - committedUsd;
    const projected = spentUsd + committedUsd + estimate;
    const scope = budget.projectId ? "project" : "workspace";
    let result: SpendPreflight;

    if (projected > budget.monthlyLimitUsd && budget.hardStop) {
      result = {
        decision: "blocked",
        estimateUsd,
        remainingUsd: remaining,
        reason: `This would take the ${scope} past its $${budget.monthlyLimitUsd} monthly limit`,
      };
    } else if (budget.approvalAboveUsd !== null && estimate > budget.approvalAboveUsd) {
      result = {
        decision: "needs_approval",
        estimateUsd,
        remainingUsd: remaining,
        reason: `Spend above $${budget.approvalAboveUsd} needs an approver`,
      };
    } else if (
      estimateUsd === null ||
      projected > budget.monthlyLimitUsd ||
      projected > (budget.monthlyLimitUsd * budget.softLimitPercent) / 100
    ) {
      result = {
        decision: "warn",
        estimateUsd,
        remainingUsd: remaining,
        reason:
          estimateUsd === null
            ? "No estimate is available for this spend"
            : `This takes the ${scope} past ${budget.softLimitPercent}% of its monthly limit`,
      };
    } else {
      result = { decision: "allow", estimateUsd, remainingUsd: remaining, reason: null };
    }

    if (
      rank[result.decision] > rank[tightest.decision] ||
      (result.decision === tightest.decision &&
        result.remainingUsd !== null &&
        (tightest.remainingUsd === null || result.remainingUsd < tightest.remainingUsd))
    ) {
      tightest = result;
    }
  }

  return tightest;
}
