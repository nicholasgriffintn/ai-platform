import { parseDeviceSyncTopic } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

const MEMBER_ROLES = ["owner", "admin", "member"] as const;

async function hasWorkspaceMembership(
  database: D1Database,
  workspaceId: string,
  userId: number,
): Promise<boolean> {
  const row = await database
    .prepare(
      `SELECT 1 AS allowed
       FROM workspace_member
       WHERE workspace_id = ? AND user_id = ? AND role IN (${MEMBER_ROLES.map(() => "?").join(", ")})
       LIMIT 1`,
    )
    .bind(workspaceId, userId, ...MEMBER_ROLES)
    .first<{ allowed: number }>();

  return Boolean(row?.allowed);
}

async function hasProjectAccess(
  database: D1Database,
  projectId: string,
  userId: number,
): Promise<boolean> {
  const row = await database
    .prepare(`SELECT workspace_id FROM project WHERE id = ? LIMIT 1`)
    .bind(projectId)
    .first<{ workspace_id: string }>();

  return row?.workspace_id ? hasWorkspaceMembership(database, row.workspace_id, userId) : false;
}

async function hasConversationAccess(
  database: D1Database,
  conversationId: string,
  userId: number,
): Promise<boolean> {
  const row = await database
    .prepare(`SELECT user_id, project_id FROM conversation WHERE id = ? LIMIT 1`)
    .bind(conversationId)
    .first<{ user_id: number | null; project_id: string | null }>();

  if (!row) {
    return false;
  }

  if (row.project_id) {
    return hasProjectAccess(database, row.project_id, userId);
  }

  return row.user_id === userId;
}

async function hasRunAccess(database: D1Database, runId: string, userId: number): Promise<boolean> {
  const row = await database
    .prepare(`SELECT conversation_id FROM conversation_run WHERE id = ? LIMIT 1`)
    .bind(runId)
    .first<{ conversation_id: string }>();

  return row?.conversation_id
    ? hasConversationAccess(database, row.conversation_id, userId)
    : false;
}

async function hasMachineAccess(
  database: D1Database,
  machineId: string,
  userId: number,
): Promise<boolean> {
  const row = await database
    .prepare(`SELECT 1 AS allowed FROM machine WHERE machine_id = ? AND user_id = ? LIMIT 1`)
    .bind(machineId, userId)
    .first<{ allowed: number }>();

  return Boolean(row?.allowed);
}

export async function canSubscribeToTopic(
  env: IEnv | undefined,
  topic: string,
  userId: number,
): Promise<boolean> {
  const parsed = parseDeviceSyncTopic(topic);

  if (!parsed) {
    return false;
  }

  if (parsed.kind === "user") {
    return parsed.id === String(userId);
  }

  const database = env?.DB;

  if (!database) {
    return false;
  }

  switch (parsed.kind) {
    case "conversation":
      return hasConversationAccess(database, parsed.id, userId);
    case "project":
      return hasProjectAccess(database, parsed.id, userId);
    case "workspace":
      return hasWorkspaceMembership(database, parsed.id, userId);
    case "run":
      return hasRunAccess(database, parsed.id, userId);
    case "machine":
      return hasMachineAccess(database, parsed.id, userId);
    default:
      return false;
  }
}
