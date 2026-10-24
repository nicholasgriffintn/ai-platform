import type { GovernanceReport } from "@ngriffin_uk/polychat-schemas";
import { formatCountLabel, formatCredits } from "@ngriffin_uk/polychat-utility-core";

const MICROS_PER_CREDIT = 1_000_000;

export function describeMonthRuns(runs: GovernanceReport["runs"]): string {
  if (runs.total === 0) {
    return "Nothing ran on your behalf yet.";
  }

  const others =
    runs.startedByOthers > 0 ? `, ${runs.startedByOthers} started by routines or other agents` : "";
  const failed = runs.failed > 0 ? `, ${runs.failed} did not finish` : "";

  return `${formatCountLabel(runs.total, "run", "runs")}${others}${failed}.`;
}

export function describeMonthApprovals(approvals: GovernanceReport["approvals"]): string {
  if (approvals.requested === 0) {
    return "Nothing needed your approval.";
  }

  const busiest = approvals.topOperations[0];
  const outcomes = [
    `${approvals.approved} allowed`,
    approvals.rejected > 0 ? `${approvals.rejected} declined` : null,
    approvals.expired > 0 ? `${approvals.expired} expired` : null,
    approvals.pending > 0 ? `${approvals.pending} waiting` : null,
  ].filter((outcome) => outcome !== null);
  const mostAsked = busiest
    ? ` Most asked: ${busiest.provider} ${busiest.operation.replaceAll("_", " ")}.`
    : "";

  return `${formatCountLabel(approvals.requested, "approval", "approvals")} asked: ${outcomes.join(", ")}.${mostAsked}`;
}

export function describeMonthSpend(spend: GovernanceReport["spend"]): string {
  if (spend.teammates.length === 0) {
    return "No teammate spend yet.";
  }

  const capped = spend.teammates.filter((teammate) => teammate.state === "reached");
  const atCap =
    capped.length > 0
      ? `. At their cap: ${capped.map((teammate) => teammate.teammateName).join(", ")}`
      : "";

  return `${formatCredits(spend.creditMicros / MICROS_PER_CREDIT)} credits across ${formatCountLabel(
    spend.teammates.length,
    "teammate",
    "teammates",
  )}${atCap}.`;
}
