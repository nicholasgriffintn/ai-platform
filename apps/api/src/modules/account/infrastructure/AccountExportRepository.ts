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

const OWN_REVISIONS_FROM = `resource_revision v JOIN resource r
  ON r.resource_type = v.resource_type
  AND r.id = COALESCE(v.document_id, v.skill_id, v.output_id, v.source_id)`;
const OWN_REVISION = `COALESCE(v.created_by, v.created_by_user_id) = ? AND ${OWN_RESOURCE}`;

function ownRevisionParams(userId: number): unknown[] {
  return [userId, ...ownResourceParams(userId)];
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
      r.created_at, r.updated_at`,
    from: "resource r",
    where: `r.resource_type = 'source' AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  outputs: {
    select: `r.id, r.project_id, r.conversation_id, r.parent_output_id, r.collection_id, r.kind,
      r.title, r.status, r.sensitivity, r.content, r.mime_type, r.filename, r.byte_size,
      r.revision, r.created_at, r.updated_at`,
    from: "resource r",
    where: `r.resource_type = 'output' AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  skills: {
    select: `r.id, r.title AS name, r.project_id, r.archived_at, r.created_at, r.updated_at,
      revision.description, revision.size AS byte_size`,
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
    select: `t.id, t.kind, t.name, t.description, t.category, t.tags, t.configuration, t.status,
      t.project_id, t.created_at, t.updated_at`,
    from: "template t",
    where: `t.created_by_user_id = ? AND (t.workspace_id IS NULL OR t.workspace_id IN (${MEMBER_WORKSPACES}))`,
    cursor: "t.id",
    params: ownScopedParams,
  },
  revisions: {
    select: `v.id, v.resource_type, v.document_id, v.skill_id, v.output_id, v.source_id, v.revision,
      v.title, v.text_content, v.content, v.change_note, v.description, v.operation, v.created_at`,
    from: OWN_REVISIONS_FROM,
    where: OWN_REVISION,
    cursor: "v.id",
    params: ownRevisionParams,
  },
  tasks: {
    select: `t.id, t.project_id, t.number, t.key, t.kind, t.objective, t.description, t.priority,
      t.parent_task_id, t.start_at, t.due_at, t.status, t.source, t.acceptance_criteria,
      t.assumptions, t.kill_conditions, t.retrospective, t.expected_output, t.constraints,
      t.created_at, t.updated_at, t.completed_at`,
    from: "project_task t",
    where: `t.created_by_user_id = ? AND t.project_id IN (${MEMBER_PROJECTS})`,
    cursor: "t.id",
    params: ownScopedParams,
  },
  recipe_triggers: {
    select: `e.id, e.installation_id, e.project_id, e.provider_id, e.trigger_slug, e.configuration,
      e.condition, e.status, e.created_at, e.updated_at`,
    from: "event_subscription e",
    where: `e.created_by_user_id = ? AND (e.project_id IS NULL OR e.project_id IN (${MEMBER_PROJECTS}))`,
    cursor: "e.id",
    params: ownScopedParams,
  },
  routine_outcomes: {
    select: `o.id, o.project_id, o.routine_kind, o.routine_id, o.run_id, o.status,
      o.false_completion, o.occurred_at`,
    from: "routine_outcome o",
    where: `o.user_id = ? AND (o.project_id IS NULL OR o.project_id IN (${MEMBER_PROJECTS}))`,
    cursor: "o.id",
    params: ownScopedParams,
  },
  saved_items: {
    select: `s.id, s.saved_conversation_id AS conversation_id, s.message_id, s.note, s.saved_at`,
    from: "user_resource_state s",
    where: `s.resource_type = 'message' AND s.user_id = ?
      AND s.saved_conversation_id IN (${REACHABLE_CONVERSATIONS})`,
    cursor: "s.id",
    params: ownScopedParams,
  },
  feedback: {
    select: `s.id, s.resource_type, s.teammate_id, s.publication_id, s.rating, s.verdict, s.note,
      s.created_at`,
    from: "user_resource_state s",
    where: `s.resource_type IN ('teammate_rating', 'teammate_feedback') AND s.user_id = ?`,
    cursor: "s.id",
    params: (userId) => [userId],
  },
  output_reviews: {
    select: `o.id, o.output_id, o.output_revision, o.project_id, o.verdict, o.brief, o.dissent,
      o.created_at`,
    from: "output_review o",
    where: `o.reviewed_by_user_id = ? AND (o.project_id IS NULL OR o.project_id IN (${MEMBER_PROJECTS}))`,
    cursor: "o.id",
    params: ownScopedParams,
  },
  approvals: {
    select: `a.id, a.kind, a.project_id, a.state, a.provider, a.operation, a.channel, a.created_at,
      a.resolved_at`,
    from: "approval a",
    where: `a.user_id = ? AND (a.project_id IS NULL OR a.project_id IN (${MEMBER_PROJECTS}))`,
    cursor: "a.id",
    params: ownScopedParams,
  },
  training_examples: {
    select: `t.id, t.conversation_id, t.source, t.app_name, t.user_prompt, t.assistant_response,
      t.model_used, t.feedback_rating, t.feedback_comment, t.created_at, t.updated_at`,
    from: "training_examples t",
    where: `t.user_id = ? AND (t.conversation_id IS NULL OR t.conversation_id IN (${REACHABLE_CONVERSATIONS}))`,
    cursor: "t.id",
    params: ownScopedParams,
  },
  benchmark_runs: {
    select: `b.id, b.benchmark_id, b.version, b.status, b.items_total, b.items_completed, b.score,
      b.metrics, b.created_at, b.completed_at`,
    from: "benchmark_run b",
    where: `b.owner_user_id = ? AND (b.workspace_id IS NULL OR b.workspace_id IN (${MEMBER_WORKSPACES}))`,
    cursor: "b.id",
    params: ownScopedParams,
  },
  benchmark_votes: {
    select: `b.id, b.benchmark_id, b.version, b.item_id, b.winner, b.created_at`,
    from: "benchmark_vote b",
    where: `b.voter_user_id = ?`,
    cursor: "b.id",
    params: (userId) => [userId],
  },
  pets: {
    select: `p.id, p.name, p.description, p.origin, p.prompt, p.created_at`,
    from: "user_pet p",
    where: `p.user_id = ?`,
    cursor: "p.id",
    params: (userId) => [userId],
  },
} satisfies Record<string, ExportQuery>;

interface FileQuery {
  select: string;
  from: string;
  where: string;
  cursor: string;
  params: (userId: number) => unknown[];
}

const FILE_QUERIES = {
  sources: {
    select: `r.id, r.storage_key, COALESCE(r.filename, r.title) AS name, r.byte_size`,
    from: "resource r",
    where: `r.resource_type = 'source' AND r.storage_key IS NOT NULL AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  outputs: {
    select: `r.id, r.storage_key, COALESCE(r.filename, r.title) AS name, r.byte_size`,
    from: "resource r",
    where: `r.resource_type = 'output' AND r.storage_key IS NOT NULL AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  skills: {
    select: `r.id, revision.storage_key, r.title AS name, revision.size AS byte_size`,
    from: `resource r JOIN resource_revision revision
      ON revision.skill_id = r.id
      AND revision.id = COALESCE(r.stable_revision_id, r.draft_revision_id)`,
    where: `r.resource_type = 'skill' AND revision.storage_key IS NOT NULL AND ${OWN_RESOURCE}`,
    cursor: "r.id",
    params: ownResourceParams,
  },
  revisions: {
    select: `v.id, v.storage_key, COALESCE(v.title, r.filename, r.title) AS name, v.size AS byte_size`,
    from: OWN_REVISIONS_FROM,
    where: `${OWN_REVISION} AND v.storage_key IS NOT NULL
      AND v.storage_key IS NOT r.storage_key
      AND v.id IS NOT COALESCE(r.stable_revision_id, r.draft_revision_id)`,
    cursor: "v.id",
    params: ownRevisionParams,
  },
  pets: {
    select: `p.id, p.sheet_key AS storage_key, p.name, NULL AS byte_size`,
    from: "user_pet p",
    where: `p.user_id = ? AND p.sheet_key IS NOT NULL`,
    cursor: "p.id",
    params: (userId) => [userId],
  },
} satisfies Record<string, FileQuery>;

export const ACCOUNT_EXPORT_FILE_SECTIONS = Object.keys(FILE_QUERIES) as AccountExportFileSection[];

export type AccountExportFileSection = keyof typeof FILE_QUERIES;

export interface AccountExportFileRow {
  id: string;
  storage_key: string;
  name: string | null;
  byte_size: number | null;
}

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

  public async listFiles(
    section: AccountExportFileSection,
    userId: number,
    after: string,
  ): Promise<AccountExportFileRow[]> {
    const query: FileQuery = FILE_QUERIES[section];

    return this.runQuery<AccountExportFileRow>(
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
      `SELECT id, conversation_id, parent_message_id, role, content, parts, citations, name, model,
         status, mode, is_archived, timestamp, tool_calls, tool_call_id, tool_call_arguments,
         created_at, updated_at
       FROM message
       WHERE conversation_id IN (${conversationIds.map(() => "?").join(", ")}) AND id > ?
       ORDER BY id
       LIMIT ?`,
      [...conversationIds, after, ACCOUNT_EXPORT_PAGE_SIZE],
    );
  }
}
