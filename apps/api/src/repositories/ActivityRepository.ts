import { BaseRepository } from "./BaseRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export type ActivityStatus =
	| "queued"
	| "running"
	| "waiting"
	| "succeeded"
	| "failed"
	| "cancelled";

export interface ActivityRecord {
	id: string;
	created_by_user_id: number;
	project_id: string | null;
	conversation_id: string | null;
	capability_id: string;
	group_id: string | null;
	kind: string;
	status: ActivityStatus;
	summary: string;
	data: string;
	created_at: string;
	updated_at: string;
}

export class ActivityRepository extends BaseRepository {
	async createActivity(input: {
		createdByUserId: number;
		projectId?: string | null;
		conversationId?: string | null;
		capabilityId: string;
		groupId?: string | null;
		kind: string;
		status: ActivityStatus;
		summary: string;
		data?: unknown;
	}): Promise<ActivityRecord> {
		const insert = this.buildInsertQuery(
			"activity_record",
			{
				id: generateId(),
				created_by_user_id: input.createdByUserId,
				project_id: input.projectId ?? null,
				conversation_id: input.conversationId ?? null,
				capability_id: input.capabilityId,
				group_id: input.groupId ?? null,
				kind: input.kind,
				status: input.status,
				summary: input.summary,
				data: input.data ?? {},
			},
			{ jsonFields: ["data"], returning: "*" },
		);
		if (!insert) throw new AssistantError("Failed to build activity", ErrorType.INTERNAL_ERROR);
		const activity = await this.runQuery<ActivityRecord>(insert.query, insert.values, true);
		if (!activity) throw new AssistantError("Failed to create activity", ErrorType.DATABASE_ERROR);
		return activity;
	}

	async getActivityById(activityId: string): Promise<ActivityRecord | null> {
		const { query, values } = this.buildSelectQuery("activity_record", { id: activityId });
		return this.runQuery<ActivityRecord>(query, values, true);
	}

	async getPersonalActivityByGroup(
		userId: number,
		capabilityId: string,
		groupId: string,
	): Promise<ActivityRecord | null> {
		const { query, values } = this.buildSelectQuery("activity_record", {
			created_by_user_id: userId,
			project_id: null,
			capability_id: capabilityId,
			group_id: groupId,
		});
		return this.runQuery<ActivityRecord>(query, values, true);
	}

	async listPersonalActivities(userId: number, capabilityId?: string): Promise<ActivityRecord[]> {
		const { query, values } = this.buildSelectQuery(
			"activity_record",
			{ created_by_user_id: userId, project_id: null, capability_id: capabilityId },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<ActivityRecord>(query, values);
	}

	async listProjectActivities(projectId: string, capabilityId?: string): Promise<ActivityRecord[]> {
		const { query, values } = this.buildSelectQuery(
			"activity_record",
			{ project_id: projectId, capability_id: capabilityId },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<ActivityRecord>(query, values);
	}

	async updateActivity(
		activityId: string,
		updates: { status?: ActivityStatus; summary?: string; data?: unknown },
	): Promise<ActivityRecord | null> {
		const update = this.buildUpdateQuery(
			"activity_record",
			updates,
			["status", "summary", "data"],
			"id = ?",
			[activityId],
			{ jsonFields: ["data"] },
		);
		if (update) await this.executeRun(update.query, update.values);
		return this.getActivityById(activityId);
	}
}
