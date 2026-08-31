import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

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
    id?: string;
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
    if (input.id) {
      await this.executeRun(
        `INSERT OR IGNORE INTO activity_record (
           id, created_by_user_id, project_id, conversation_id, capability_id, group_id,
           kind, status, summary, data
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.createdByUserId,
          input.projectId ?? null,
          input.conversationId ?? null,
          input.capabilityId,
          input.groupId ?? null,
          input.kind,
          input.status,
          input.summary,
          JSON.stringify(input.data ?? {}),
        ],
      );
      const existing = await this.getActivityById(input.id);

      if (!existing) {
        throw new AssistantError("Failed to create activity", ErrorType.DATABASE_ERROR);
      }

      return existing;
    }

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

    if (!insert) {
      throw new AssistantError("Failed to build activity", ErrorType.INTERNAL_ERROR);
    }

    const activity = await this.runQuery<ActivityRecord>(insert.query, insert.values, true);

    if (!activity) {
      throw new AssistantError("Failed to create activity", ErrorType.DATABASE_ERROR);
    }

    return activity;
  }

  async getActivityById(activityId: string): Promise<ActivityRecord | null> {
    const { query, values } = this.buildSelectQuery("activity_record", { id: activityId });

    return this.runQuery<ActivityRecord>(query, values, true);
  }

  async getActivityByGroup(capabilityId: string, groupId: string): Promise<ActivityRecord | null> {
    const { query, values } = this.buildSelectQuery("activity_record", {
      capability_id: capabilityId,
      group_id: groupId,
    });

    return this.runQuery<ActivityRecord>(query, values, true);
  }

  async listRecentUserActivities(userId: number, capabilityId: string): Promise<ActivityRecord[]> {
    return this.runQuery<ActivityRecord>(
      `SELECT * FROM activity_record
			 WHERE created_by_user_id = ?
			   AND capability_id = ?
			   AND (status IN ('queued', 'running', 'waiting') OR created_at >= datetime('now', '-1 day'))
			 ORDER BY created_at DESC`,
      [userId, capabilityId],
    );
  }

  async listPersonalActivities(
    userId: number,
    options: {
      capabilityId?: string;
      status?: ActivityStatus;
      limit: number;
      offset: number;
    },
  ): Promise<ActivityRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "activity_record",
      {
        created_by_user_id: userId,
        project_id: null,
        capability_id: options.capabilityId,
        status: options.status,
      },
      { orderBy: "created_at DESC", limit: options.limit, offset: options.offset },
    );

    return this.runQuery<ActivityRecord>(query, values);
  }

  async listProjectActivities(
    projectId: string,
    options: {
      capabilityId?: string;
      status?: ActivityStatus;
      limit: number;
      offset: number;
    },
  ): Promise<ActivityRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "activity_record",
      {
        project_id: projectId,
        capability_id: options.capabilityId,
        status: options.status,
      },
      { orderBy: "created_at DESC", limit: options.limit, offset: options.offset },
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

    if (update) {
      await this.executeRun(update.query, update.values);
    }

    return this.getActivityById(activityId);
  }

  async compareAndSetActivity(
    activityId: string,
    expectedStatuses: readonly ActivityStatus[],
    updates: { status?: ActivityStatus; summary?: string; data?: unknown },
  ): Promise<ActivityRecord | null> {
    const columns: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      columns.push("status = ?");
      values.push(updates.status);
    }

    if (updates.summary !== undefined) {
      columns.push("summary = ?");
      values.push(updates.summary);
    }

    if (updates.data !== undefined) {
      columns.push("data = ?");
      values.push(JSON.stringify(updates.data));
    }

    if (columns.length === 0 || expectedStatuses.length === 0) {
      return null;
    }

    const placeholders = expectedStatuses.map(() => "?").join(", ");

    columns.push("updated_at = CURRENT_TIMESTAMP");
    values.push(activityId, ...expectedStatuses);

    return this.runQuery<ActivityRecord>(
      `UPDATE activity_record
       SET ${columns.join(", ")}
       WHERE id = ? AND status IN (${placeholders})
       RETURNING *`,
      values,
      true,
    );
  }

  async cancelActiveActivitiesByGroup(capabilityId: string, groupId: string): Promise<void> {
    await this.executeRun(
      `UPDATE activity_record
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE capability_id = ?
         AND group_id = ?
         AND status IN ('queued', 'running', 'waiting')`,
      [capabilityId, groupId],
    );
  }
}
