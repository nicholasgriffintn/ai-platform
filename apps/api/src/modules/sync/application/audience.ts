import type { SyncEnv } from "./publish";

const AUDIENCE_CACHE_TTL_MS = 15_000;

interface CachedEntry<T> {
  value: T;
  expiresAt: number;
}

interface ConversationScope {
  userId: number | null;
  projectId: string | null;
}

const workspaceMembersCache = new Map<string, CachedEntry<number[]>>();
const projectWorkspaceCache = new Map<string, CachedEntry<string | null>>();
const conversationScopeCache = new Map<string, CachedEntry<ConversationScope | null>>();

function readCache<T>(cache: Map<string, CachedEntry<T>>, key: string): T | undefined {
  const cached = cache.get(key);

  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);

    return undefined;
  }

  return cached.value;
}

function writeCache<T>(cache: Map<string, CachedEntry<T>>, key: string, value: T): T {
  if (value === null || (Array.isArray(value) && value.length === 0)) {
    return value;
  }

  cache.set(key, { value, expiresAt: Date.now() + AUDIENCE_CACHE_TTL_MS });

  return value;
}

export function forgetWorkspaceAudience(workspaceId: string): void {
  workspaceMembersCache.delete(workspaceId);
}

export function clearAudienceCache(): void {
  workspaceMembersCache.clear();
  projectWorkspaceCache.clear();
  conversationScopeCache.clear();
}

export async function workspaceAudience(
  env: SyncEnv | undefined,
  workspaceId: string,
): Promise<number[]> {
  const database = env?.DB;

  if (!database) {
    return [];
  }

  const cached = readCache(workspaceMembersCache, workspaceId);

  if (cached) {
    return cached;
  }

  const result = await database
    .prepare(`SELECT user_id FROM workspace_member WHERE workspace_id = ?`)
    .bind(workspaceId)
    .all<{ user_id: number }>();

  return writeCache(
    workspaceMembersCache,
    workspaceId,
    (result.results ?? []).map((row) => row.user_id),
  );
}

export async function projectAudience(
  env: SyncEnv | undefined,
  projectId: string,
): Promise<number[]> {
  const database = env?.DB;

  if (!database) {
    return [];
  }

  let workspaceId = readCache(projectWorkspaceCache, projectId);

  if (workspaceId === undefined) {
    const project = await database
      .prepare(`SELECT workspace_id FROM project WHERE id = ? LIMIT 1`)
      .bind(projectId)
      .first<{ workspace_id: string }>();

    workspaceId = writeCache(projectWorkspaceCache, projectId, project?.workspace_id ?? null);
  }

  return workspaceId ? workspaceAudience(env, workspaceId) : [];
}

export async function conversationAudience(
  env: SyncEnv | undefined,
  conversationId: string,
): Promise<number[]> {
  const database = env?.DB;

  if (!database) {
    return [];
  }

  let scope = readCache(conversationScopeCache, conversationId);

  if (scope === undefined) {
    const conversation = await database
      .prepare(`SELECT user_id, project_id FROM conversation WHERE id = ? LIMIT 1`)
      .bind(conversationId)
      .first<{ user_id: number | null; project_id: string | null }>();

    scope = writeCache(
      conversationScopeCache,
      conversationId,
      conversation ? { userId: conversation.user_id, projectId: conversation.project_id } : null,
    );
  }

  if (!scope) {
    return [];
  }

  if (scope.projectId) {
    return projectAudience(env, scope.projectId);
  }

  return scope.userId ? [scope.userId] : [];
}
