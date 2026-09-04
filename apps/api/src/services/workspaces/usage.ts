import {
  creditsFromCreditMicros,
  usagePeriodFromDate,
  type UsageSummaryQuery,
  type WorkspaceUsageSummaryResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { toSummaryGroups, totalUsageGroups } from "~/lib/usage/summary";

import { requireWorkspaceAccess } from "./access";

export async function getWorkspaceUsageSummary(
  context: ServiceContext,
  workspaceId: string,
  query: UsageSummaryQuery,
): Promise<WorkspaceUsageSummaryResponse> {
  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const period = query.period ?? usagePeriodFromDate();
  const [bySource, byVendor, byProject] = await Promise.all([
    context.repositories.usageEvents.summariseWorkspacePeriodBy(workspaceId, period, "source"),
    context.repositories.usageEvents.summariseWorkspacePeriodBy(workspaceId, period, "vendor"),
    context.repositories.usageEvents.summariseWorkspacePeriodBy(workspaceId, period, "project"),
  ]);
  const totals = totalUsageGroups(bySource);

  return {
    period,
    totals: { ...totals, credits: creditsFromCreditMicros(totals.credit_micros) },
    by_source: toSummaryGroups(bySource),
    by_vendor: toSummaryGroups(byVendor),
    by_project: toSummaryGroups(byProject),
  };
}
