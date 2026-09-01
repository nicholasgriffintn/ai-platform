import {
  creditsFromCreditMicros,
  usagePeriodFromDate,
  usagePeriodResetsAt,
  type UsageBalanceResponse,
  type UsageEventsQuery,
  type UsageEventsResponse,
  type UsageSummaryQuery,
  type UsageSummaryResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { resolveUsageBalanceSnapshot } from "~/lib/usage/balanceSnapshot";
import type { CreditActor } from "~/lib/usage/creditActor";
import { usageCreditsFromBalance } from "~/lib/usage/creditSummary";
import type { UsageEventGroupRow } from "~/repositories/UsageEventRepository";
import { decodeCompositeCursor, encodeCompositeCursor } from "~/utils/cursor";

const DEFAULT_EVENT_PAGE_SIZE = 25;

function toSummaryGroups(rows: UsageEventGroupRow[]) {
  return rows.map((row) => ({
    key: row.key,
    cost_micros: row.cost_micros,
    credit_micros: row.credit_micros,
    credits: creditsFromCreditMicros(row.credit_micros),
    event_count: row.event_count,
  }));
}

export async function getUsageBalance(
  context: ServiceContext,
  actor: CreditActor,
  period = usagePeriodFromDate(),
): Promise<UsageBalanceResponse> {
  const balance = await resolveUsageBalanceSnapshot(context.repositories, actor, period);

  const included = balance.included_credit_micros;
  const grace = balance.grace_credit_micros;
  const spent = balance.spent_credit_micros;
  const reserved = balance.reserved_credit_micros;
  const overrun = balance.overrun_credit_micros;
  const overage = balance.overage_credit_micros;
  const overageEnabled = Boolean(balance.overage_enabled);

  return {
    period,
    resets_at: usagePeriodResetsAt(period),
    plan_id: balance.plan_id,
    credits: usageCreditsFromBalance({
      included_credit_micros: included,
      grace_credit_micros: grace,
      spent_credit_micros: spent,
      reserved_credit_micros: reserved,
      overrun_credit_micros: overrun,
      overage_credit_micros: overage,
      overage_enabled: overageEnabled ? 1 : 0,
    }),
    credit_micros: {
      included,
      spent,
      reserved,
      grace,
      overrun,
      overage,
    },
    last_event_at: balance.last_event_at,
  };
}

export async function getUsageSummary(
  context: ServiceContext,
  userId: number,
  query: UsageSummaryQuery,
): Promise<UsageSummaryResponse> {
  const period = query.period ?? usagePeriodFromDate();
  const [bySource, byVendor] = await Promise.all([
    context.repositories.usageEvents.summariseUserPeriodBy(userId, period, "source"),
    context.repositories.usageEvents.summariseUserPeriodBy(userId, period, "vendor"),
  ]);

  const totals = bySource.reduce(
    (accumulator, row) => ({
      cost_micros: accumulator.cost_micros + row.cost_micros,
      credit_micros: accumulator.credit_micros + row.credit_micros,
      event_count: accumulator.event_count + row.event_count,
    }),
    { cost_micros: 0, credit_micros: 0, event_count: 0 },
  );

  return {
    period,
    totals: { ...totals, credits: creditsFromCreditMicros(totals.credit_micros) },
    by_source: toSummaryGroups(bySource),
    by_vendor: toSummaryGroups(byVendor),
  };
}

export async function listUsageEvents(
  context: ServiceContext,
  userId: number,
  query: UsageEventsQuery,
): Promise<UsageEventsResponse> {
  const period = query.period ?? usagePeriodFromDate();
  const limit = query.limit ?? DEFAULT_EVENT_PAGE_SIZE;
  const decoded = query.cursor ? decodeCompositeCursor(query.cursor, 2) : null;
  const cursor = decoded ? { occurredAt: decoded[0], id: decoded[1] } : null;

  const rows = await context.repositories.usageEvents.listUserEvents({
    userId,
    period,
    limit: limit + 1,
    cursor,
  });

  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return {
    period,
    events: page.map((row) => ({
      id: row.id,
      occurred_at: row.occurred_at,
      period: row.period,
      source: row.source,
      vendor: row.vendor,
      resource: row.resource,
      unit: row.unit,
      quantity: row.quantity,
      cost_micros: row.cost_micros,
      credit_micros: row.credit_micros,
      credits: creditsFromCreditMicros(row.credit_micros),
      billable: Boolean(row.billable),
      byok: Boolean(row.byok),
      estimated: Boolean(row.estimated),
      conversation_id: row.conversation_id,
      project_id: row.project_id,
      workspace_id: row.workspace_id,
    })),
    next_cursor:
      rows.length > limit && last ? encodeCompositeCursor([last.occurred_at, last.id]) : null,
  };
}
