import { BaseRepository, D1_MAX_BOUND_PARAMETERS } from "~/infrastructure/database/BaseRepository";

export type AccountExportRow = Record<string, unknown>;

export const ACCOUNT_EXPORT_PAGE_SIZE = 200;
export const ACCOUNT_EXPORT_MESSAGE_CONVERSATIONS = D1_MAX_BOUND_PARAMETERS - 10;

const MEMBER_WORKSPACES = `SELECT workspace_id FROM resource_grant
  WHERE kind = 'membership' AND user_id = ?`;
const MEMBER_PROJECTS = `SELECT id FROM project WHERE workspace_id IN (${MEMBER_WORKSPACES})`;
const REACHABLE_CONVERSATIONS = `SELECT id FROM conversation
  WHERE project_id IS NULL OR project_id IN (${MEMBER_PROJECTS})`;

const OWN_RESOURCE = `r.created_by_user_id = ? AND r.deleted_at IS NULL AND (
  (r.scope_type = 'personal' AND r.scope_id = ?)
  OR (r.scope_type = 'project' AND r.scope_id IN (${MEMBER_PROJECTS}))
)`;

function ownResourceParams(userId: number): unknown[] {
  return [userId, String(userId), userId];
}

function ownScopedParams(userId: number): unknown[] {
  return [userId, userId];
}

interface ExportQuery {
  select: string;
  from: string;
  where: string;
  cursor: string;
  params: (userId: number) => unknown[];
}

const EXPORT_QUERIES = {
  conversations: {
    select: `c.id, c.type, c.title, c.is_archived, c.is_public, c.project_id, c.model_id,
      c.parent_conversation_id, c.created_at, c.updated_at`,
    from: "conversation c",
    where: `c.user_id = ? AND (c.project_id IS NULL OR c.project_id IN (${MEMBER_PROJECTS}))`,
    cursor: "c.id",
    params: ownScopedParams,
  },
  memory: {
    select: `r.id, r.kind, r.title AS name, r.content, r.metadata, r.project_id, r.revision,
      r.created_at, r.updated_at`,
    from: "resource r",
    where: `r.resource_type = 'memory' AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  memory_syntheses: {
    select: `r.id, r.content, r.revision, r.namespace, r.memory_count, r.is_active,
      r.created_at, r.updated_at`,
    from: "resource r",
    where: `r.resource_type = 'synthesis' AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  sources: {
    select: `r.id, r.project_id, r.conversation_id, r.collection_id, r.kind, r.title, r.status,
      r.content, r.provider, r.external_uri, r.mime_type, r.filename, r.byte_size, r.revision,
      r.created_at, r.updated_at, r.storage_key`,
    from: "resource r",
    where: `r.resource_type = 'source' AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  outputs: {
    select: `r.id, r.project_id, r.conversation_id, r.parent_output_id, r.collection_id, r.kind,
      r.title, r.status, r.sensitivity, r.content, r.mime_type, r.filename, r.byte_size,
      r.revision, r.created_at, r.updated_at, r.storage_key`,
    from: "resource r",
    where: `r.resource_type = 'output' AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  skills: {
    select: `r.id, r.title AS name, r.project_id, r.archived_at, r.created_at, r.updated_at,
      revision.description, revision.size AS byte_size, revision.storage_key`,
    from: `resource r LEFT JOIN resource_revision revision
      ON revision.skill_id = r.id
      AND revision.id = COALESCE(r.stable_revision_id, r.draft_revision_id)`,
    where: `r.resource_type = 'skill' AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  collections: {
    select: `c.id, c.collection_type, c.title, c.description, c.kind, c.instructions, c.guide,
      c.project_id, c.created_at, c.updated_at`,
    from: "resource_collection c",
    where: `c.created_by_user_id = ? AND (c.project_id IS NULL OR c.project_id IN (${MEMBER_PROJECTS}))`,
    cursor: "c.id",
    params: ownScopedParams,
  },
  comments: {
    select: `c.id, c.output_id, c.source_id, c.parent_id, c.body, c.resolved, c.created_at,
      c.updated_at`,
    from: `document_comment c JOIN resource r
      ON r.id = COALESCE(c.output_id, c.source_id)
      AND r.resource_type = CASE WHEN c.output_id IS NULL THEN 'source' ELSE 'output' END`,
    where: `c.author_user_id = ? AND r.deleted_at IS NULL AND (
      (r.scope_type = 'personal' AND r.scope_id = ?)
      OR (r.scope_type = 'project' AND r.scope_id IN (${MEMBER_PROJECTS}))
    )`,
    cursor: "c.id",
    params: (userId) => [userId, String(userId), userId],
  },
  goals: {
    select: `g.id, g.conversation_id, g.objective, g.status, g.source, g.progress,
      g.stopped_reason, g.created_at, g.updated_at, g.completed_at`,
    from: "goal g",
    where: `g.user_id = ? AND (g.conversation_id IS NULL OR g.conversation_id IN (${REACHABLE_CONVERSATIONS}))`,
    cursor: "g.id",
    params: ownScopedParams,
  },
  corrections: {
    select: `c.id, c.pattern, c.quote, c.conversation_id, c.placement, c.status, c.created_at`,
    from: "correction c",
    where: `c.user_id = ? AND (c.conversation_id IS NULL OR c.conversation_id IN (${REACHABLE_CONVERSATIONS}))`,
    cursor: "c.id",
    params: ownScopedParams,
  },
  teammates: {
    select: `t.id, t.kind, t.name, t.description, t.model, t.temperature, t.max_steps,
      t.system_prompt, t.few_shot_examples, t.enabled_tools, t.skill_ids, t.mode, t.created_at,
      t.updated_at`,
    from: "teammates t",
    where: `t.user_id = ? AND t.owner_scope_type = 'user'`,
    cursor: "t.id",
    params: (userId) => [userId],
  },
  templates: {
    select: `t.id, t.kind, t.name, t.description, t.category, t.tags, t.status, t.project_id,
      t.created_at, t.updated_at`,
    from: "template t",
    where: `t.created_by_user_id = ? AND (t.workspace_id IS NULL OR t.workspace_id IN (${MEMBER_WORKSPACES}))`,
    cursor: "t.id",
    params: ownScopedParams,
  },
} satisfies Record<string, ExportQuery>;

export type AccountExportSection = keyof typeof EXPORT_QUERIES;

export class AccountExportRepository extends BaseRepository {
  public async listSection(
    section: AccountExportSection,
    userId: number,
    after: string,
  ): Promise<AccountExportRow[]> {
    const query: ExportQuery = EXPORT_QUERIES[section];

    return this.runQuery<AccountExportRow>(
      `SELECT ${query.select}
       FROM ${query.from}
       WHERE ${query.where} AND ${query.cursor} > ?
       ORDER BY ${query.cursor}
       LIMIT ?`,
      [...query.params(userId), after, ACCOUNT_EXPORT_PAGE_SIZE],
    );
  }

  public async listMessages(
    conversationIds: readonly string[],
    after: string,
  ): Promise<AccountExportRow[]> {
    return this.runQuery<AccountExportRow>(
      `SELECT id, conversation_id, parent_message_id, role, content, citations, name, model,
         status, mode, is_archived, timestamp, created_at, updated_at
       FROM message
       WHERE conversation_id IN (${conversationIds.map(() => "?").join(", ")}) AND id > ?
       ORDER BY id
       LIMIT ?`,
      [...conversationIds, after, ACCOUNT_EXPORT_PAGE_SIZE],
    );
  }
}
