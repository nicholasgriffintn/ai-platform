import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";

import { applyTestMigration } from "./migrations";

export async function initialiseNativeMemoryDatabase(database: D1Database) {
  await database.exec(`
    CREATE TABLE user (id INTEGER PRIMARY KEY);
    CREATE TABLE conversation (id TEXT PRIMARY KEY);
    CREATE TABLE conversation_run (id TEXT PRIMARY KEY, context_json TEXT, conversation_id TEXT, teammate_context_id TEXT, initiator_user_id INTEGER, trigger TEXT);
    CREATE TABLE teammate_context (id TEXT PRIMARY KEY, actor_user_id INTEGER, memory_document_id TEXT, status TEXT, home_conversation_id TEXT);
    CREATE TABLE message (id TEXT PRIMARY KEY, conversation_id TEXT, run_id TEXT, role TEXT, content TEXT, data TEXT, timestamp INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE tasks (id TEXT PRIMARY KEY, status TEXT, execution_owner_token TEXT, execution_lease_expires_at TEXT, task_type TEXT DEFAULT 'memory_reflection', user_id INTEGER DEFAULT 1, task_data TEXT DEFAULT '{}', error_message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO user VALUES (1);
    INSERT INTO conversation VALUES ('conversation');
    INSERT INTO teammate_context VALUES ('context', 1, 'memory', 'active', 'conversation');
    INSERT INTO tasks (id, status, execution_owner_token, execution_lease_expires_at) VALUES ('task', 'running', 'owner', '2099-01-01T00:00:00.000Z');
    INSERT INTO conversation_run (id, context_json) VALUES ('legacy-run', '{"protocolVersion":1,"documents":[{"id":"memory","kind":"memory","revision":1,"access":"read"}]}');
  `);
  await applyTestMigration(
    database,
    await readFile(new URL("../../migrations/0031_memory_documents.sql", import.meta.url), "utf8"),
  );
  await database.batch([
    database.prepare("ALTER TABLE memory_document ADD kind TEXT NOT NULL DEFAULT 'memory'"),
    database.prepare("ALTER TABLE memory_document_revision ADD operation_id TEXT"),
    database.prepare(
      "CREATE UNIQUE INDEX memory_operation ON memory_document_revision(document_id, operation_id) WHERE operation_id IS NOT NULL",
    ),
  ]);
  await applyTestMigration(
    database,
    await readFile(new URL("../../migrations/0059_native_memory.sql", import.meta.url), "utf8"),
  );
  await database.batch([
    database.prepare(
      "INSERT INTO memory_document (id, scope_type, scope_id, kind, name, content, revision, created_by) VALUES ('memory', 'personal', '1', 'teammate_context', 'working-memory', 'Deploy to Netlify. Keep concise answers.', 1, 1)",
    ),
    database.prepare(
      "INSERT INTO memory_document_revision (id, document_id, revision, content, created_by) SELECT 'revision-1', id, revision, content, created_by FROM memory_document",
    ),
  ]);
}
