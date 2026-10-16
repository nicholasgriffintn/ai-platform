import { toSummaryGroups, totalUsageGroups } from "@ngriffin_uk/polychat-ai-billing";
import {
  creditsFromCreditMicros,
  usagePeriodFromDate,
  type UsageSummaryQuery,
  type WorkspaceUsageSummaryResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";

export async function getWorkspaceUsageSummary(
  context: ServiceContext,
  workspaceId: string,
  query: UsageSummaryQuery,
): Promise<WorkspaceUsageSummaryResponse> {
  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const period = query.period ?? usagePeriodFromDate();
  const [bySource, byVendor, byProject] = await Promise.all([
    context.repositories
      .get(UsageEventRepository)
      .summariseWorkspacePeriodBy(workspaceId, period, "source"),
    context.repositories
      .get(UsageEventRepository)
      .summariseWorkspacePeriodBy(workspaceId, period, "vendor"),
    context.repositories
      .get(UsageEventRepository)
      .summariseWorkspacePeriodBy(workspaceId, period, "project"),
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
