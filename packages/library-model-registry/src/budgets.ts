import { authorise } from "@ngriffin_uk/polychat-library-policy";
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
    const context = {
      valid: [
        spentUsd,
        committedUsd,
        estimate,
        budget.monthlyLimitUsd,
        budget.softLimitPercent,
        budget.approvalAboveUsd ?? 0,
      ].every((amount) => Number.isFinite(amount) && amount >= 0),
      hardStop: budget.hardStop,
      overMonthly: projected > budget.monthlyLimitUsd,
      aboveApproval: budget.approvalAboveUsd !== null && estimate > budget.approvalAboveUsd,
      unknownEstimate: estimateUsd === null,
      overSoft: projected > (budget.monthlyLimitUsd * budget.softLimitPercent) / 100,
    };
    let result: SpendPreflight;

    if (!authorise("spend.execute", context).allowed) {
      result = {
        decision: "blocked",
        estimateUsd,
        remainingUsd: remaining,
        reason: context.valid
          ? `This would take the ${scope} past its $${budget.monthlyLimitUsd} monthly limit`
          : "Spend cannot be authorised with invalid budget amounts",
      };
    } else if (!authorise("spend.unattended", context).allowed) {
      result = {
        decision: "needs_approval",
        estimateUsd,
        remainingUsd: remaining,
        reason: `Spend above $${budget.approvalAboveUsd} needs an approver`,
      };
    } else if (!authorise("spend.silent", context).allowed) {
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
