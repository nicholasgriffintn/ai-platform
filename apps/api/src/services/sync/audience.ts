import type { IEnv } from "~/types";

async function workspaceMemberIds(database: D1Database, workspaceId: string): Promise<number[]> {
  const result = await database
    .prepare(`SELECT user_id FROM workspace_member WHERE workspace_id = ?`)
    .bind(workspaceId)
    .all<{ user_id: number }>();

  return (result.results ?? []).map((row) => row.user_id);
}

export async function projectAudience(env: IEnv | undefined, projectId: string): Promise<number[]> {
  const database = env?.DB;

  if (!database) {
    return [];
  }

  const project = await database
    .prepare(`SELECT workspace_id FROM project WHERE id = ? LIMIT 1`)
    .bind(projectId)
    .first<{ workspace_id: string }>();

  return project?.workspace_id ? workspaceMemberIds(database, project.workspace_id) : [];
}

export async function workspaceAudience(
  env: IEnv | undefined,
  workspaceId: string,
): Promise<number[]> {
  const database = env?.DB;

  return database ? workspaceMemberIds(database, workspaceId) : [];
}

export async function conversationAudience(
  env: IEnv | undefined,
  conversationId: string,
): Promise<number[]> {
  const database = env?.DB;

  if (!database) {
    return [];
  }

  const conversation = await database
    .prepare(`SELECT user_id, project_id FROM conversation WHERE id = ? LIMIT 1`)
    .bind(conversationId)
    .first<{ user_id: number | null; project_id: string | null }>();

  if (!conversation) {
    return [];
  }

  if (conversation.project_id) {
    return projectAudience(env, conversation.project_id);
  }

  return conversation.user_id ? [conversation.user_id] : [];
}
