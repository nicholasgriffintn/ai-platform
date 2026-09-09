import { SANDBOX_RUNS_CAPABILITY_ID } from "@ngriffin_uk/polychat-schemas";

import { publishProjectEvent } from "~/services/sync/conversation-events";
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
  private announce(record: ActivityRecord | null): void {
    if (record?.capability_id === SANDBOX_RUNS_CAPABILITY_ID && record.project_id) {
      void publishProjectEvent({ env: this.env }, record.project_id, "workbench_run.changed", {
        conversationId: record.conversation_id,
        activityId: record.id,
        status: record.status,
      });
    }
  }

  private async announceGroup(capabilityId: string, groupId: string): Promise<void> {
    if (capabilityId !== SANDBOX_RUNS_CAPABILITY_ID) {
      return;
    }

    const records = await this.runQuery<ActivityRecord>(
      `SELECT * FROM activity_record WHERE capability_id = ? AND group_id = ?`,
      [capabilityId, groupId],
    );

    for (const record of records) {
      this.announce(record);
    }
  }

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

    if (!insert) {
      throw new AssistantError("Failed to build activity", ErrorType.INTERNAL_ERROR);
    }

    const activity = await this.runQuery<ActivityRecord>(insert.query, insert.values, true);

    if (!activity) {
      throw new AssistantError("Failed to create activity", ErrorType.DATABASE_ERROR);
    }

    this.announce(activity);

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
      conversationId?: string;
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
        conversation_id: options.conversationId,
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
      conversationId?: string;
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
        conversation_id: options.conversationId,
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

    const record = await this.getActivityById(activityId);

    this.announce(record);

    return record;
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
    await this.announceGroup(capabilityId, groupId);
  }

  async failActiveActivitiesByGroup(
    capabilityId: string,
    groupId: string,
    summary: string,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE activity_record
       SET status = 'failed', summary = ?, updated_at = CURRENT_TIMESTAMP
       WHERE capability_id = ?
         AND group_id = ?
         AND status IN ('queued', 'running')`,
      [summary.slice(0, 200), capabilityId, groupId],
    );
    await this.announceGroup(capabilityId, groupId);
  }
}
