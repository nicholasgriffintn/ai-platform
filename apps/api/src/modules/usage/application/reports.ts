import {
  resolveUsageBalanceResponse,
  userCreditActor,
  type CreditActor,
  recordOffPlatformRunUsage,
  toSummaryGroups,
  totalUsageGroups,
} from "@ngriffin_uk/polychat-ai-billing";
import {
  creditsFromCreditMicros,
  mapListPage,
  toListPage,
  usagePeriodFromDate,
  type UsageBalanceResponse,
  type RecordOffPlatformUsageRequest,
  type UsageEventsQuery,
  type UsageEventsResponse,
  type UsageSummaryQuery,
  type UsageSummaryResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createUsageRuntime, createUsageStore } from "~/modules/usage/application/runtime";

export async function recordOffPlatformUsage(
  context: ServiceContext,
  userId: number,
  input: RecordOffPlatformUsageRequest,
): Promise<{ success: true; message: string }> {
  await recordOffPlatformRunUsage(
    createUsageRuntime({ env: context.env, repositories: context.repositories }),
    {
      actor: userCreditActor(userId),
      provenance: input.provenance,
      completionId: input.completion_id,
      conversationId: input.completion_id,
      messageId: input.message_id,
    },
  );

  return { success: true, message: "Off-platform run recorded" };
}

export async function getUsageBalance(
  context: ServiceContext,
  actor: CreditActor,
  period = usagePeriodFromDate(),
): Promise<UsageBalanceResponse> {
  return resolveUsageBalanceResponse(createUsageStore(context.repositories), actor, period);
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

  const totals = totalUsageGroups(bySource);

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
  const limit = query.limit;

  const rows = await context.repositories.usageEvents.listUserEvents({
    userId,
    period,
    limit: limit + 1,
    after: query.after ?? null,
    source: query.source ?? null,
  });

  return {
    ...mapListPage(
      toListPage(rows, limit, (row) => row.id),
      (row) => ({
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
        vendor_units: row.vendor_units,
        reason: row.reason,
        site: row.site,
        conversation_id: row.conversation_id,
        project_id: row.project_id,
        workspace_id: row.workspace_id,
      }),
    ),
    period,
  };
}
