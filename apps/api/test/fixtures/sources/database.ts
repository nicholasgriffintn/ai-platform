import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";

import { applyTestMigration } from "../../migrations";

export async function prepareKnowledgeDatabase(database: D1Database): Promise<void> {
  await applyTestMigration(
    database,
    `
    CREATE TABLE user (id INTEGER PRIMARY KEY, email TEXT);
    INSERT INTO user VALUES (1, 'one@example.com'), (2, 'two@example.com');
    CREATE TABLE project (id TEXT PRIMARY KEY, workspace_id TEXT);
    CREATE TABLE workspace_member (workspace_id TEXT, user_id INTEGER, role TEXT);
    INSERT INTO project VALUES ('project-1', 'workspace-1'), ('project-2', 'workspace-2');
    INSERT INTO workspace_member VALUES ('workspace-1', 1, 'owner'), ('workspace-1', 2, 'member');
    CREATE TABLE provider_connection (id TEXT PRIMARY KEY, status TEXT, user_id INTEGER DEFAULT 1,
      provider TEXT DEFAULT 'googledrive', kind TEXT DEFAULT 'recipe_connector_account', external_id TEXT DEFAULT 'account',
      encrypted_data TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT);
    CREATE TABLE tasks (id TEXT PRIMARY KEY, status TEXT);
    CREATE TABLE activity_record (id TEXT PRIMARY KEY, created_by_user_id INTEGER, project_id TEXT, capability_id TEXT, group_id TEXT, updated_at TEXT, data TEXT);
    INSERT INTO activity_record VALUES ('run-record', 1, 'project-1', 'sandbox_runs', 'historical-run', CURRENT_TIMESTAMP,
      '{"runId":"historical-run","status":"completed","repo":"owner/repo","task":"Deliver the feature","result":{"summary":"Completed safely"}}');
    INSERT INTO provider_connection (id, status) VALUES ('connection', 'connected');
    CREATE TABLE source (id TEXT PRIMARY KEY, created_by_user_id INTEGER, project_id TEXT,
      title TEXT, kind TEXT, status TEXT, content TEXT, metadata TEXT DEFAULT '{}',
      connection_id TEXT REFERENCES provider_connection(id) ON DELETE SET NULL,
      external_uri TEXT, provider TEXT, storage_key TEXT, mime_type TEXT,
      conversation_id TEXT, vector_id TEXT, filename TEXT, byte_size INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT);
    CREATE TABLE embedding_document (id TEXT PRIMARY KEY, user_id INTEGER, scope_type TEXT, lifecycle_status TEXT, title TEXT, type TEXT, metadata TEXT,
      provider TEXT DEFAULT 'quarantined', provider_target TEXT DEFAULT 'quarantined-legacy', embedding_model TEXT DEFAULT 'unknown-legacy',
      embedding_dimensions INTEGER DEFAULT 1, distance_metric TEXT DEFAULT 'unknown', task_mode TEXT DEFAULT 'unknown',
      vector_space TEXT DEFAULT 'legacy-unresolved', vector_space_version TEXT DEFAULT 'legacy');
    CREATE TABLE embedding_chunk (id TEXT PRIMARY KEY, vector_id TEXT, document_id TEXT REFERENCES embedding_document(id) ON DELETE CASCADE, lifecycle_status TEXT, chunk_index INTEGER, content TEXT);
    INSERT INTO embedding_document (id, user_id, scope_type, lifecycle_status, title, type, metadata)
      VALUES ('saved-note', 1, 'personal', 'active', 'Previous note', 'note', '{}');
    INSERT INTO embedding_chunk VALUES ('old-second', 'old-vector-second', 'saved-note', 'active', 1, 'Second'), ('old-first', 'old-vector-first', 'saved-note', 'active', 0, 'First');
  `.replaceAll(";", ";--> statement-breakpoint"),
  );
  await applyTestMigration(
    database,
    await readFile(
      new URL("../../../migrations/0058_source_knowledge.sql", import.meta.url),
      "utf8",
    ),
  );
  await applyTestMigration(
    database,
    await readFile(new URL("../../../migrations/0059_source_sync.sql", import.meta.url), "utf8"),
  );
}
