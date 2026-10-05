import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";

import type { SourceSearchRepository } from "~/modules/sources/infrastructure/SourceSearchRepository";
import type { IUser } from "~/types";

import { applyTestMigration } from "../helpers/migrations";

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
      provider TEXT DEFAULT 'notion', kind TEXT DEFAULT 'recipe_connector_account', external_id TEXT DEFAULT 'account',
      encrypted_data TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT);
    CREATE TABLE project_capability (project_id TEXT, kind TEXT, capability_id TEXT, excluded INTEGER);
    INSERT INTO project_capability VALUES ('project-1', 'recipe', 'knowledge', 0);
    CREATE TABLE tasks (id TEXT PRIMARY KEY, status TEXT, task_type TEXT, task_data TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, execution_lease_expires_at TEXT);
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
    CREATE TABLE embedding_document (id TEXT PRIMARY KEY, user_id INTEGER, scope_type TEXT, lifecycle_status TEXT, title TEXT, type TEXT, metadata TEXT);
    CREATE TABLE embedding_chunk (id TEXT PRIMARY KEY, vector_id TEXT, document_id TEXT REFERENCES embedding_document(id) ON DELETE CASCADE, lifecycle_status TEXT, chunk_index INTEGER, content TEXT);
    INSERT INTO embedding_document (id, user_id, scope_type, lifecycle_status, title, type, metadata)
      VALUES ('saved-note', 1, 'personal', 'active', 'Previous note', 'note', '{}');
    INSERT INTO embedding_chunk VALUES ('old-second', 'old-vector-second', 'saved-note', 'active', 1, 'Second'), ('old-first', 'old-vector-first', 'saved-note', 'active', 0, 'First');
  `.replaceAll(";", ";--> statement-breakpoint"),
  );
  await applyTestMigration(
    database,
    await readFile(new URL("../../migrations/0058_source_knowledge.sql", import.meta.url), "utf8"),
  );
  await applyTestMigration(
    database,
    await readFile(
      new URL("../../migrations/0059_personal_source_knowledge.sql", import.meta.url),
      "utf8",
    ),
  );
}

export async function addIndexedKnowledgeSource(
  database: D1Database,
  repository: SourceSearchRepository,
  input: { id: string; projectId: string | null; userId: number; connectionId: string | null },
): Promise<void> {
  await database
    .prepare(`INSERT INTO source (id, created_by_user_id, project_id, title, kind, status, content, connection_id)
    VALUES (?, ?, ?, 'Incident decisions', 'text', 'available', 'INC-4821 release decision', ?)`)
    .bind(input.id, input.userId, input.projectId, input.connectionId)
    .run();
  const source = await repository.getSource(input.id);

  if (!source) {
    throw new Error("Knowledge fixture source missing");
  }

  await repository.prepare(
    source,
    {
      documentId: `index-${input.id}`,
      logicalId: input.id,
      title: source.title,
      content: source.content ?? "",
      chunks: [
        {
          id: `vector-${input.id}`,
          vectorId: `vector-${input.id}`,
          index: 0,
          content: source.content ?? "",
        },
      ],
    },
    {
      embeddingProvider: "vectorize",
      providerTarget: "vectorize-binding",
      model: "@cf/baai/bge-base-en-v1.5",
      dimensions: 768,
      distanceMetric: "cosine",
      taskMode: "symmetric",
      vectorSpace: "default",
      vectorSpaceVersion: "1",
    },
    input.userId,
  );
  await repository.claim(`index-${input.id}`, "fixture", "lexical");
  if (!(await repository.activate(`index-${input.id}`, "fixture"))) {
    throw new Error("Knowledge fixture activation failed");
  }

  await repository.release(`index-${input.id}`, "fixture");
}

export const knowledgeTestUser: IUser = {
  id: 1,
  name: null,
  avatar_url: null,
  email: "one@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: null,
};
