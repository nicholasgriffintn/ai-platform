import type { IEnv } from "~/types";

const AUDIENCE_CACHE_TTL_MS = 15_000;

interface CachedAudience {
  members: number[];
  expiresAt: number;
}

const audienceCache = new Map<string, CachedAudience>();

function readCache(key: string): number[] | undefined {
  const cached = audienceCache.get(key);

  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    audienceCache.delete(key);

    return undefined;
  }

  return cached.members;
}

function writeCache(key: string, members: number[]): number[] {
  audienceCache.set(key, { members, expiresAt: Date.now() + AUDIENCE_CACHE_TTL_MS });

  return members;
}

export function forgetAudience(key: string): void {
  audienceCache.delete(key);
}

export function clearAudienceCache(): void {
  audienceCache.clear();
}

async function workspaceMemberIds(database: D1Database, workspaceId: string): Promise<number[]> {
  const result = await database
    .prepare(`SELECT user_id FROM workspace_member WHERE workspace_id = ?`)
    .bind(workspaceId)
    .all<{ user_id: number }>();

  return (result.results ?? []).map((row) => row.user_id);
}

export async function workspaceAudience(
  env: IEnv | undefined,
  workspaceId: string,
): Promise<number[]> {
  const database = env?.DB;

  if (!database) {
    return [];
  }

  const key = `workspace:${workspaceId}`;

  return readCache(key) ?? writeCache(key, await workspaceMemberIds(database, workspaceId));
}

export async function projectAudience(env: IEnv | undefined, projectId: string): Promise<number[]> {
  const database = env?.DB;

  if (!database) {
    return [];
  }

  const key = `project:${projectId}`;
  const cached = readCache(key);

  if (cached) {
    return cached;
  }

  const project = await database
    .prepare(`SELECT workspace_id FROM project WHERE id = ? LIMIT 1`)
    .bind(projectId)
    .first<{ workspace_id: string }>();

  return writeCache(
    key,
    project?.workspace_id ? await workspaceMemberIds(database, project.workspace_id) : [],
  );
}

export async function conversationAudience(
  env: IEnv | undefined,
  conversationId: string,
): Promise<number[]> {
  const database = env?.DB;

  if (!database) {
    return [];
  }

  const key = `conversation:${conversationId}`;
  const cached = readCache(key);

  if (cached) {
    return cached;
  }

  const conversation = await database
    .prepare(`SELECT user_id, project_id FROM conversation WHERE id = ? LIMIT 1`)
    .bind(conversationId)
    .first<{ user_id: number | null; project_id: string | null }>();

  if (!conversation) {
    return writeCache(key, []);
  }

  if (conversation.project_id) {
    return writeCache(key, await projectAudience(env, conversation.project_id));
  }

  return writeCache(key, conversation.user_id ? [conversation.user_id] : []);
}
