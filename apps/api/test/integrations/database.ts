import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";

import type { IUser } from "~/types";

import { applyTestMigration } from "../migrations";

export async function initialiseIntegrationDatabase(database: D1Database): Promise<void> {
  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE workspace (id TEXT PRIMARY KEY)"),
    database.prepare("INSERT INTO user VALUES (1), (2)"),
    database.prepare("INSERT INTO workspace VALUES ('workspace'), ('foreign')"),
    database.prepare(
      "CREATE TABLE workspace_member (workspace_id TEXT, user_id INTEGER, role TEXT, PRIMARY KEY (workspace_id, user_id))",
    ),
    database.prepare(
      "INSERT INTO workspace_member VALUES ('workspace', 1, 'owner'), ('workspace', 2, 'member')",
    ),
    database.prepare(
      "CREATE TABLE project (id TEXT PRIMARY KEY, workspace_id TEXT, archived_at TEXT)",
    ),
    database.prepare(
      "INSERT INTO project VALUES ('project', 'workspace', NULL), ('foreign-project', 'foreign', NULL)",
    ),
    database.prepare(
      "CREATE TABLE conversation (id TEXT PRIMARY KEY, project_id TEXT, is_archived INTEGER)",
    ),
    database.prepare(`CREATE TABLE project_capability (
      id TEXT PRIMARY KEY, project_id TEXT, kind TEXT, capability_id TEXT, configuration TEXT,
      excluded INTEGER DEFAULT 0, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    database.prepare(`CREATE TABLE capability_configuration (
      id TEXT PRIMARY KEY, scope_type TEXT, scope_id TEXT, capability_kind TEXT, capability_id TEXT, configuration TEXT)`),
    database.prepare(`CREATE TABLE teammate_context (
      id TEXT PRIMARY KEY, teammate_id TEXT, actor_user_id INTEGER, scope_type TEXT, scope_id TEXT,
      home_conversation_id TEXT, memory_document_id TEXT, status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT)`),
    database.prepare(`CREATE TABLE teammate_connection_grant (
      id TEXT PRIMARY KEY, context_id TEXT, connection_id TEXT, allowed_operations TEXT, revision INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT, UNIQUE(context_id, connection_id))`),
    database.prepare(`CREATE TABLE provider_connection (
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, provider TEXT NOT NULL, kind TEXT NOT NULL,
      external_id TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'connected', encrypted_data TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT,
      UNIQUE (user_id, provider, kind, external_id))`),
  ]);
  const migration = await readFile(
    new URL("../../migrations/0058_native_integrations.sql", import.meta.url),
    "utf8",
  );

  await applyTestMigration(database, migration);
}

export function integrationTestUser(id: number): IUser {
  return {
    id,
    name: `Member ${id}`,
    email: `member${id}@example.com`,
    avatar_url: null,
    github_username: null,
    company: null,
    site: null,
    location: null,
    bio: null,
    twitter_username: null,
    created_at: "2026-10-04T00:00:00Z",
    updated_at: "2026-10-04T00:00:00Z",
    setup_at: null,
    terms_accepted_at: null,
    plan_id: "pro",
  };
}
