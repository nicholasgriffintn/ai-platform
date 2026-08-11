import type { ActivityRecord as Activity, ActivityStatus } from "@assistant/schemas";
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
	filters: { projectId?: string; capabilityId?: string; status?: ActivityStatus },
): Promise<{ activities: Activity[] }> {
	const records = filters.projectId
		? (await requireProjectAccess(context, filters.projectId),
			await context.repositories.activities.listProjectActivities(
				filters.projectId,
				filters.capabilityId,
			))
		: await context.repositories.activities.listPersonalActivities(userId, filters.capabilityId);
	return {
		activities: records
			.filter((record) => !filters.status || record.status === filters.status)
			.map(formatActivity),
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
