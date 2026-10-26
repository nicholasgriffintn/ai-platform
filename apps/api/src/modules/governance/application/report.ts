import { resolveSpendState } from "@ngriffin_uk/polychat-ai-billing";
import {
  chatRunStatusSchema,
  chatRunTriggerSchema,
  isOwnerStartedTrigger,
  usagePeriodFromDate,
  usagePeriodResetsAt,
  type ChatRunStatus,
  type ChatRunTrigger,
  type GovernanceReport,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listPolyStandingApprovals } from "~/modules/approvals/application/standing";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import {
  UsageEventRepository,
  type TeammateSpendRow,
} from "~/modules/usage/infrastructure/UsageEventRepository";

const TOP_OPERATIONS = 5;
const FAILED_STATUSES = new Set<ChatRunStatus>(["failed", "interrupted"]);

export interface GovernanceSources {
  period: string;
  generatedAt: string;
  runs: Array<{ trigger: string | null; status: string; count: number }>;
  approvals: Array<{
    state: string;
    provider: string | null;
    operation: string | null;
    count: number;
  }>;
  standingApprovals: number;
  spend: TeammateSpendRow[];
}

function increment<K extends string>(record: Partial<Record<K, number>>, key: K, count: number) {
  record[key] = (record[key] ?? 0) + count;
}

function summariseRuns(rows: GovernanceSources["runs"]): GovernanceReport["runs"] {
  const byTrigger: Partial<Record<ChatRunTrigger, number>> = {};
  const byStatus: Partial<Record<ChatRunStatus, number>> = {};
  let total = 0;
  let failed = 0;
  let startedByOthers = 0;

  for (const row of rows) {
    const trigger = chatRunTriggerSchema.catch("user").parse(row.trigger ?? "user");
    const status = chatRunStatusSchema.safeParse(row.status);

    total += row.count;
    increment(byTrigger, trigger, row.count);

    if (!isOwnerStartedTrigger(trigger)) {
      startedByOthers += row.count;
    }

    if (status.success) {
      increment(byStatus, status.data, row.count);

      if (FAILED_STATUSES.has(status.data)) {
        failed += row.count;
      }
    }
  }

  return { total, failed, startedByOthers, byTrigger, byStatus };
}

function summariseApprovals(rows: GovernanceSources["approvals"]): GovernanceReport["approvals"] {
  const byState = new Map<string, number>();
  const byOperation = new Map<string, { provider: string; operation: string; count: number }>();

  for (const row of rows) {
    byState.set(row.state, (byState.get(row.state) ?? 0) + row.count);

    const provider = row.provider ?? "unknown";
    const operation = row.operation ?? "unknown";
    const key = `${provider}\u0000${operation}`;
    const existing = byOperation.get(key);

    byOperation.set(key, {
      provider,
      operation,
      count: (existing?.count ?? 0) + row.count,
    });
  }

  const count = (state: string) => byState.get(state) ?? 0;

  return {
    requested: [...byState.values()].reduce((total, value) => total + value, 0),
    approved: count("approved") + count("consumed"),
    rejected: count("rejected"),
    expired: count("expired"),
    executed: count("consumed"),
    pending: count("pending"),
    topOperations: [...byOperation.values()]
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.provider.localeCompare(right.provider) ||
          left.operation.localeCompare(right.operation),
      )
      .slice(0, TOP_OPERATIONS),
  };
}

function summariseSpend(rows: TeammateSpendRow[]): GovernanceReport["spend"] {
  const teammates = rows.map((row) => {
    const creditMicros = Math.max(0, Math.round(row.credit_micros));
    const capCreditMicros =
      row.monthly_credit_cap_micros && row.monthly_credit_cap_micros > 0
        ? row.monthly_credit_cap_micros
        : null;

    return {
      teammateContextId: row.teammate_context_id,
      teammateId: row.teammate_id,
      teammateName: row.teammate_name ?? "Teammate",
      creditMicros,
      runCount: Math.max(0, Math.round(row.run_count)),
      capCreditMicros,
      state: resolveSpendState(creditMicros, capCreditMicros),
    };
  });

  return {
    creditMicros: teammates.reduce((total, teammate) => total + teammate.creditMicros, 0),
    teammates,
  };
}

export function periodRange(period: string): { from: string; to: string } {
  return { from: `${period}-01T00:00:00.000Z`, to: usagePeriodResetsAt(period) };
}

export function summariseGovernance(sources: GovernanceSources): GovernanceReport {
  return {
    period: sources.period,
    ...periodRange(sources.period),
    generatedAt: sources.generatedAt,
    runs: summariseRuns(sources.runs),
    approvals: summariseApprovals(sources.approvals),
    standingApprovals: sources.standingApprovals,
    spend: summariseSpend(sources.spend),
  };
}

export async function readGovernanceReport(
  context: ServiceContext,
  period = usagePeriodFromDate(),
): Promise<GovernanceReport> {
  const user = context.requireUser();
  const range = periodRange(period);
  const generatedAt = new Date().toISOString();
  const [runs, approvals, standing, spend] = await Promise.all([
    context.repositories.get(ConversationRunRepository).countForInitiator(user.id, range),
    context.repositories
      .get(ConnectorOperationApprovalRepository)
      .countForUser(user.id, range, generatedAt),
    listPolyStandingApprovals(context),
    context.repositories.get(UsageEventRepository).summariseTeammateSpendForUser(user.id, period),
  ]);

  return summariseGovernance({
    period,
    generatedAt,
    runs,
    approvals,
    standingApprovals: standing.data.length,
    spend,
  });
}
