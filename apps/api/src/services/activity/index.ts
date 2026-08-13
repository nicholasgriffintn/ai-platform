import type { ActivityRecord as Activity, ActivityStatus } from "@ngriffin_uk/polychat-schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ActivityRecord } from "~/repositories/ActivityRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

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
	filters: {
		projectId?: string;
		capabilityId?: string;
		status?: ActivityStatus;
		limit: number;
		offset: number;
	},
): Promise<{ activities: Activity[]; hasMore: boolean }> {
	const pageOptions = {
		capabilityId: filters.capabilityId,
		status: filters.status,
		limit: filters.limit + 1,
		offset: filters.offset,
	};
	const records = filters.projectId
		? (await requireProjectAccess(context, filters.projectId),
			await context.repositories.activities.listProjectActivities(filters.projectId, pageOptions))
		: await context.repositories.activities.listPersonalActivities(userId, pageOptions);
	return {
		activities: records.slice(0, filters.limit).map(formatActivity),
		hasMore: records.length > filters.limit,
	};
}

export async function getActivity(
	context: ServiceContext,
	userId: number,
	activityId: string,
): Promise<Activity> {
	const record = await context.repositories.activities.getActivityById(activityId);
	if (!record) throw new AssistantError("Activity not found", ErrorType.NOT_FOUND, 404);
	if (record.project_id) {
		await requireProjectAccess(context, record.project_id);
	} else if (record.created_by_user_id !== userId) {
		throw new AssistantError("Activity not found", ErrorType.NOT_FOUND, 404);
	}
	return formatActivity(record);
}
