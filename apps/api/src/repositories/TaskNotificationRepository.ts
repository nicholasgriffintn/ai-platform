import {
  TASK_NOTIFICATION_PROTOCOL_VERSION,
  createTaskInboxItemId,
  parseTaskInboxItemId,
  type RegisterTaskNotification,
  type ProjectTaskBlockedReason,
  type ProjectTaskStatus,
  type TaskNotificationCategory,
  type TaskNotificationPreferences,
  type TaskNotificationRegistration,
} from "@ngriffin_uk/polychat-schemas";

import type { TaskNotificationDeliveryRow } from "~/lib/database/schema";
import {
  decryptJsonPayload,
  encryptJsonPayload,
  isEncryptedJsonPayload,
  sha256Hex,
} from "~/utils/crypto";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

const DEFAULT_PREFERENCES: TaskNotificationPreferences = {
  enabled: true,
  decisions: true,
  failures: true,
  completions: true,
  assignments: true,
};

interface PreferenceRow {
  enabled: number | boolean;
  decisions: number | boolean;
  failures: number | boolean;
  completions: number | boolean;
  assignments: number | boolean;
}

interface RegistrationRow {
  id: string;
  user_id: number;
  installation_id: string;
  platform: "web" | "ios";
  endpoint_hash: string;
  destination_json: unknown;
  state: "registered" | "failed" | "disabled";
  failure_code: string | null;
  updated_at: string;
}

export interface TaskInboxRow {
  task_id: string;
  task_version: number;
  project_id: string;
  workspace_id: string;
  project_name: string;
  objective: string;
  status: "backlog" | "blocked" | "review" | "done";
  blocked_reason: ProjectTaskBlockedReason | null;
  blocked_detail: string | null;
  assignee_user_id: number | null;
  created_by_user_id: number;
  conversation_id: string | null;
  updated_at: string;
  completed_at: string | null;
  read_at: string | null;
}

export interface TaskNotificationDeliveryContext {
  delivery: TaskNotificationDeliveryRow;
  registration: RegistrationRow & {
    endpoint: string;
    p256dh: string | null;
    authSecret: string | null;
  };
  task: {
    id: string;
    workspaceId: string;
    projectId: string;
    attentionVersion: number;
    status: ProjectTaskStatus;
    blockedReason: ProjectTaskBlockedReason | null;
    assigneeUserId: number | null;
    createdByUserId: number;
  };
  hasWorkspaceAccess: boolean;
  preferences: TaskNotificationPreferences;
}

function toBoolean(value: number | boolean): boolean {
  return value === true || value === 1;
}

function formatPreferences(row: PreferenceRow | null): TaskNotificationPreferences {
  if (!row) {
    return DEFAULT_PREFERENCES;
  }

  return {
    enabled: toBoolean(row.enabled),
    decisions: toBoolean(row.decisions),
    failures: toBoolean(row.failures),
    completions: toBoolean(row.completions),
    assignments: toBoolean(row.assignments),
  };
}

function formatRegistration(row: RegistrationRow): TaskNotificationRegistration {
  return {
    id: row.id,
    installationId: row.installation_id,
    platform: row.platform,
    state: row.state,
    failureCode: row.failure_code,
    updatedAt: row.updated_at,
  };
}

export class TaskNotificationRepository extends BaseRepository {
  async getPreferences(userId: number): Promise<TaskNotificationPreferences> {
    const row = await this.runQuery<PreferenceRow>(
      `SELECT enabled, decisions, failures, completions, assignments
       FROM task_notification_preference WHERE user_id = ?`,
      [userId],
      true,
    );

    return formatPreferences(row);
  }

  async updatePreferences(
    userId: number,
    updates: Partial<TaskNotificationPreferences>,
  ): Promise<TaskNotificationPreferences> {
    const current = await this.getPreferences(userId);
    const next = { ...current, ...updates };

    await this.executeRun(
      `INSERT INTO task_notification_preference
         (user_id, enabled, decisions, failures, completions, assignments, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         enabled = excluded.enabled,
         decisions = excluded.decisions,
         failures = excluded.failures,
         completions = excluded.completions,
         assignments = excluded.assignments,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, next.enabled, next.decisions, next.failures, next.completions, next.assignments],
    );

    return next;
  }

  async listRegistrations(userId: number): Promise<TaskNotificationRegistration[]> {
    const rows = await this.runQuery<RegistrationRow>(
      `SELECT * FROM task_notification_registration
       WHERE user_id = ? ORDER BY updated_at DESC`,
      [userId],
    );

    return rows.map(formatRegistration);
  }

  async upsertRegistration(
    userId: number,
    input: RegisterTaskNotification,
  ): Promise<TaskNotificationRegistration> {
    const endpoint =
      input.platform === "ios" ? input.token.toLowerCase() : input.subscription.endpoint;
    const p256dh = input.platform === "web" ? input.subscription.keys.p256dh : null;
    const authSecret = input.platform === "web" ? input.subscription.keys.auth : null;
    const keyMaterial = this.env.PRIVATE_KEY;

    if (!keyMaterial) {
      throw new Error("Server encryption key is not configured");
    }

    const endpointHash = await sha256Hex(endpoint);
    const destination = await encryptJsonPayload({
      keyMaterial,
      payload: { endpoint, p256dh, authSecret },
      additionalData: `${userId}:${input.platform}:${input.installationId}`,
    });
    const database = this.env.DB;
    const id = generateId();

    await database.batch([
      database
        .prepare(
          `DELETE FROM task_notification_registration
           WHERE platform = ? AND endpoint_hash = ?
             AND NOT (user_id = ? AND installation_id = ?)`,
        )
        .bind(input.platform, endpointHash, userId, input.installationId),
      database
        .prepare(
          `INSERT INTO task_notification_registration
             (id, user_id, installation_id, platform, endpoint_hash, destination_json, state,
              failure_code, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'registered', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, platform, installation_id) DO UPDATE SET
             endpoint_hash = excluded.endpoint_hash,
             destination_json = excluded.destination_json,
             state = 'registered',
             failure_code = NULL,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          id,
          userId,
          input.installationId,
          input.platform,
          endpointHash,
          JSON.stringify(destination),
        ),
    ]);

    const row = await this.runQuery<RegistrationRow>(
      `SELECT * FROM task_notification_registration
       WHERE user_id = ? AND platform = ? AND installation_id = ?`,
      [userId, input.platform, input.installationId],
      true,
    );

    if (!row) {
      throw new Error("Notification registration was not persisted");
    }

    return formatRegistration(row);
  }

  async removeRegistration(userId: number, installationId: string): Promise<void> {
    await this.executeRun(
      "DELETE FROM task_notification_registration WHERE user_id = ? AND installation_id = ?",
      [userId, installationId],
    );
  }

  async listInbox(userId: number, limit: number): Promise<TaskInboxRow[]> {
    return this.runQuery<TaskInboxRow>(
      `SELECT
         pt.id AS task_id,
         pt.attention_version AS task_version,
         pt.project_id,
         pt.workspace_id,
         p.name AS project_name,
         pt.objective,
         pt.status,
         pt.blocked_reason,
         pt.blocked_detail,
         pt.assignee_user_id,
         pt.created_by_user_id,
         pt.conversation_id,
         pt.updated_at,
         pt.completed_at,
         receipt.read_at
       FROM project_task pt
       JOIN project p ON p.id = pt.project_id
       JOIN workspace_member member
         ON member.workspace_id = pt.workspace_id AND member.user_id = ?
       LEFT JOIN task_inbox_receipt receipt
         ON receipt.user_id = ?
        AND receipt.task_id = pt.id
        AND receipt.task_version = pt.attention_version
       WHERE receipt.dismissed_at IS NULL
         AND (
           pt.status IN ('blocked', 'review')
           OR (pt.status = 'backlog' AND pt.assignee_user_id = ?)
           OR (
             pt.status = 'done'
             AND (pt.created_by_user_id = ? OR pt.assignee_user_id = ?)
             AND datetime(pt.completed_at) >= datetime('now', '-30 days')
           )
         )
       ORDER BY (receipt.read_at IS NULL) DESC, pt.updated_at DESC
       LIMIT ?`,
      [userId, userId, userId, userId, userId, limit],
    );
  }

  async updateInboxReceipts(
    userId: number,
    itemIds: string[],
    action: "read" | "dismiss",
  ): Promise<number> {
    const changes = await Promise.all(
      [...new Set(itemIds)].map(async (itemId) => {
        const parsed = parseTaskInboxItemId(itemId);

        if (!parsed) {
          return 0;
        }

        const timestampColumn = action === "read" ? "read_at" : "dismissed_at";
        const result = await this.executeRun(
          `INSERT INTO task_inbox_receipt
           (user_id, task_id, task_version, read_at, dismissed_at)
         SELECT ?, pt.id, pt.attention_version,
           ${action === "read" ? "CURRENT_TIMESTAMP" : "NULL"},
           ${action === "dismiss" ? "CURRENT_TIMESTAMP" : "NULL"}
         FROM project_task pt
         JOIN workspace_member member
           ON member.workspace_id = pt.workspace_id AND member.user_id = ?
         WHERE pt.id = ? AND pt.attention_version = ?
           AND (
             pt.status IN ('blocked', 'review')
             OR (pt.status = 'backlog' AND pt.assignee_user_id = ?)
             OR (pt.status = 'done' AND (pt.created_by_user_id = ? OR pt.assignee_user_id = ?))
           )
         ON CONFLICT(user_id, task_id, task_version) DO UPDATE SET
           ${timestampColumn} = CURRENT_TIMESTAMP`,
          [userId, userId, parsed.taskId, parsed.taskVersion, userId, userId, userId],
        );

        return result.meta.changes ?? 0;
      }),
    );

    return changes.reduce((total, change) => total + change, 0);
  }

  async createDeliveries(
    taskId: string,
    taskVersion: number,
    category: TaskNotificationCategory,
    userIds: readonly number[],
  ): Promise<string[]> {
    const ids = await Promise.all(
      [...new Set(userIds)].map(async (userId) => {
        const registrations = await this.runQuery<{ id: string }>(
          `SELECT registration.id
         FROM task_notification_registration registration
         LEFT JOIN task_notification_preference preference ON preference.user_id = registration.user_id
         WHERE registration.user_id = ? AND registration.state = 'registered'
           AND COALESCE(preference.enabled, 1) = 1
           AND COALESCE(preference.${category}, 1) = 1`,
          [userId],
        );

        return Promise.all(
          registrations.map(async (registration) => {
            const id = generateId();
            const dedupeKey = `${registration.id}:${createTaskInboxItemId(taskId, taskVersion)}`;
            const result = await this.executeRun(
              `INSERT OR IGNORE INTO task_notification_delivery
             (id, dedupe_key, registration_id, user_id, task_id, task_version, category, status,
              attempts, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [id, dedupeKey, registration.id, userId, taskId, taskVersion, category],
            );

            return (result.meta.changes ?? 0) > 0 ? id : null;
          }),
        );
      }),
    );

    return ids.flat().filter((id): id is string => id !== null);
  }

  async getDeliveryContext(deliveryId: string): Promise<TaskNotificationDeliveryContext | null> {
    const row = await this.runQuery<
      TaskNotificationDeliveryRow &
        RegistrationRow & {
          registration_id_value: string;
          registration_updated_at: string;
          task_workspace_id: string;
          task_project_id: string;
          task_attention_version: number;
          task_status: ProjectTaskStatus;
          task_blocked_reason: ProjectTaskBlockedReason | null;
          task_assignee_user_id: number | null;
          task_created_by_user_id: number;
          has_workspace_access: number;
          preference_enabled: number | null;
          preference_decisions: number | null;
          preference_failures: number | null;
          preference_completions: number | null;
          preference_assignments: number | null;
        }
    >(
      `SELECT delivery.*,
         registration.id AS registration_id_value,
         registration.installation_id,
         registration.platform,
         registration.endpoint_hash,
         registration.destination_json,
         registration.state,
         registration.failure_code,
         registration.updated_at AS registration_updated_at,
         task.workspace_id AS task_workspace_id,
         task.project_id AS task_project_id,
         task.attention_version AS task_attention_version,
         task.status AS task_status,
         task.blocked_reason AS task_blocked_reason,
         task.assignee_user_id AS task_assignee_user_id,
         task.created_by_user_id AS task_created_by_user_id,
         EXISTS(
           SELECT 1 FROM workspace_member member
           WHERE member.workspace_id = task.workspace_id AND member.user_id = delivery.user_id
         ) AS has_workspace_access,
         preference.enabled AS preference_enabled,
         preference.decisions AS preference_decisions,
         preference.failures AS preference_failures,
         preference.completions AS preference_completions,
         preference.assignments AS preference_assignments
       FROM task_notification_delivery delivery
       JOIN task_notification_registration registration ON registration.id = delivery.registration_id
       JOIN project_task task ON task.id = delivery.task_id
       LEFT JOIN task_notification_preference preference ON preference.user_id = delivery.user_id
       WHERE delivery.id = ?`,
      [deliveryId],
      true,
    );

    if (!row) {
      return null;
    }

    const storedDestination =
      typeof row.destination_json === "string"
        ? safeParseJson(row.destination_json)
        : row.destination_json;

    if (!isEncryptedJsonPayload(storedDestination) || !this.env.PRIVATE_KEY) {
      throw new Error("Notification destination is not decryptable");
    }

    const destination = await decryptJsonPayload({
      keyMaterial: this.env.PRIVATE_KEY,
      encrypted: storedDestination,
      additionalData: `${row.user_id}:${row.platform}:${row.installation_id}`,
      invalidMessage: "Notification destination is invalid",
      reconnectMessage: "Notification registration must be replaced",
    });

    if (typeof destination.endpoint !== "string") {
      throw new Error("Notification destination endpoint is missing");
    }

    return {
      delivery: row,
      registration: {
        id: row.registration_id_value,
        user_id: row.user_id,
        installation_id: row.installation_id,
        platform: row.platform,
        endpoint_hash: row.endpoint_hash,
        destination_json: row.destination_json,
        endpoint: destination.endpoint,
        p256dh: typeof destination.p256dh === "string" ? destination.p256dh : null,
        authSecret: typeof destination.authSecret === "string" ? destination.authSecret : null,
        state: row.state,
        failure_code: row.failure_code,
        updated_at: row.registration_updated_at,
      },
      task: {
        id: row.task_id,
        workspaceId: row.task_workspace_id,
        projectId: row.task_project_id,
        attentionVersion: row.task_attention_version,
        status: row.task_status,
        blockedReason: row.task_blocked_reason,
        assigneeUserId: row.task_assignee_user_id,
        createdByUserId: row.task_created_by_user_id,
      },
      hasWorkspaceAccess: toBoolean(row.has_workspace_access),
      preferences: formatPreferences(
        row.preference_enabled === null
          ? null
          : {
              enabled: row.preference_enabled,
              decisions: row.preference_decisions ?? 1,
              failures: row.preference_failures ?? 1,
              completions: row.preference_completions ?? 1,
              assignments: row.preference_assignments ?? 1,
            },
      ),
    };
  }

  async updateDelivery(
    deliveryId: string,
    updates: {
      status: "pending" | "delivered" | "failed" | "obsolete";
      providerMessageId?: string | null;
      failureCode?: string | null;
      nextAttemptAt?: string | null;
      incrementAttempts?: boolean;
    },
  ): Promise<void> {
    await this.executeRun(
      `UPDATE task_notification_delivery SET
         status = ?,
         provider_message_id = ?,
         failure_code = ?,
         next_attempt_at = ?,
         attempts = attempts + ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        updates.status,
        updates.providerMessageId ?? null,
        updates.failureCode ?? null,
        updates.nextAttemptAt ?? null,
        updates.incrementAttempts ? 1 : 0,
        deliveryId,
      ],
    );
  }

  async listPendingDeliveryIds(limit = 100): Promise<string[]> {
    const rows = await this.runQuery<{ id: string }>(
      `SELECT id FROM task_notification_delivery
       WHERE status = 'pending'
         AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now'))
       ORDER BY created_at ASC LIMIT ?`,
      [limit],
    );

    return rows.map((row) => row.id);
  }

  async markRegistrationFailed(registrationId: string, failureCode: string): Promise<void> {
    await this.executeRun(
      `UPDATE task_notification_registration
       SET state = 'failed', failure_code = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [failureCode, registrationId],
    );
  }
}

export { DEFAULT_PREFERENCES, TASK_NOTIFICATION_PROTOCOL_VERSION };
