import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  mapListPage,
  toListPage,
  type ActivityListQuery,
  type ActivityRecord as Activity,
  type ListPage,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ActivityRecord } from "~/modules/activity/infrastructure/ActivityRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

function formatActivity(record: ActivityRecord): Activity {
  return {
    id: record.id,
    createdByUserId: record.created_by_user_id,
    projectId: record.project_id,
    conversationId: record.conversation_id,
    capabilityId: record.capability_id,
    groupId: record.group_id,
    kind: record.kind,
    status: record.status,
    summary: record.summary,
    data: safeParseJson<Record<string, unknown>>(record.data) ?? {},
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export async function listActivity(
  context: ServiceContext,
  userId: number,
  query: ActivityListQuery,
): Promise<ListPage<Activity>> {
  const options = {
    conversationId: query.conversation_id,
    capabilityId: query.capability_id,
    status: query.status,
    limit: query.limit + 1,
    after: query.after,
  };
  const records = query.project_id
    ? (await requireProjectAccess(context, query.project_id),
      await context.repositories.activities.listProjectActivities(query.project_id, options))
    : await context.repositories.activities.listPersonalActivities(userId, options);

  return mapListPage(
    toListPage(records, query.limit, (record) => record.id),
    formatActivity,
  );
}

export async function getActivity(
  context: ServiceContext,
  userId: number,
  activityId: string,
): Promise<Activity> {
  const record = await context.repositories.activities.getActivityById(activityId);

  if (!record) {
    throw new AssistantError("Activity not found", ErrorType.NOT_FOUND, 404);
  }

  if (record.project_id) {
    await requireProjectAccess(context, record.project_id);
  } else if (!ownsResource(userId, record.created_by_user_id)) {
    throw new AssistantError("Activity not found", ErrorType.NOT_FOUND, 404);
  }

  return formatActivity(record);
}
