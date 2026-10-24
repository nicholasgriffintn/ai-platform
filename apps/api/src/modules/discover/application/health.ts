import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_HEALTH_SUMMARY_KIND,
  discoverHealthSummarySchema,
  type DiscoverHealthSummary,
} from "@ngriffin_uk/polychat-schemas";
import { shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";

const HEALTH_FRESH_DAYS = 1;

function healthGroupId(userId: number): string {
  return `discover-health:${userId}`;
}

export async function saveDiscoverHealthSummary(
  context: ServiceContext,
  summary: DiscoverHealthSummary,
): Promise<DiscoverHealthSummary> {
  const user = context.requireUser();
  const activities = context.repositories.get(ActivityRepository);
  const existing = await activities.getActivityByGroup(
    DISCOVER_CAPABILITY_ID,
    healthGroupId(user.id),
  );

  if (existing) {
    await activities.updateActivity(existing.id, { status: "succeeded", data: summary });
  } else {
    await activities.createActivity({
      createdByUserId: user.id,
      capabilityId: DISCOVER_CAPABILITY_ID,
      groupId: healthGroupId(user.id),
      kind: DISCOVER_HEALTH_SUMMARY_KIND,
      status: "succeeded",
      summary: "Apple Health summary for the Discover brief",
      data: summary,
    });
  }

  return summary;
}

export async function clearDiscoverHealthSummary(context: ServiceContext): Promise<void> {
  const user = context.requireUser();
  const activities = context.repositories.get(ActivityRepository);
  const existing = await activities.getActivityByGroup(
    DISCOVER_CAPABILITY_ID,
    healthGroupId(user.id),
  );

  if (existing) {
    await activities.updateActivity(existing.id, { status: "cancelled", data: {} });
  }
}

export async function readDiscoverHealthSummary(
  context: ServiceContext,
  userId: number,
  today: string,
): Promise<DiscoverHealthSummary | null> {
  const record = await context.repositories
    .get(ActivityRepository)
    .getActivityByGroup(DISCOVER_CAPABILITY_ID, healthGroupId(userId));

  if (!record || record.status !== "succeeded" || record.created_by_user_id !== userId) {
    return null;
  }

  const parsed = discoverHealthSummarySchema.safeParse(safeParseJson(record.data));

  return parsed.success && parsed.data.date >= shiftCalendarDate(today, -HEALTH_FRESH_DAYS)
    ? parsed.data
    : null;
}
