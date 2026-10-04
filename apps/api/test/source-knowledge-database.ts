import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";

import { applyTestMigration } from "./migrations";

export const sourceKnowledgeRuntimeOptions = {
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
};

export async function initialiseSourceKnowledgeDatabase(database: D1Database): Promise<void> {
  await database.batch([
    database.prepare("CREATE TABLE user(id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE project(id TEXT PRIMARY KEY, workspace_id TEXT)"),
    database.prepare(
      "CREATE TABLE workspace_member(user_id INTEGER, workspace_id TEXT, role TEXT)",
    ),
    database.prepare("CREATE TABLE tasks(task_type TEXT, status TEXT, task_data TEXT)"),
    database.prepare(`CREATE TABLE provider_connection(id TEXT PRIMARY KEY, user_id INTEGER DEFAULT 1,
      provider TEXT DEFAULT 'confluence', kind TEXT DEFAULT 'recipe_connector_account',
      status TEXT DEFAULT 'connected', external_id TEXT DEFAULT 'dummy-account')`),
    database.prepare(`CREATE TABLE source(id TEXT PRIMARY KEY, created_by_user_id INTEGER, project_id TEXT,
      connection_id TEXT, kind TEXT, title TEXT, status TEXT, content TEXT, provider TEXT,
      external_uri TEXT, metadata TEXT DEFAULT '{}', updated_at TEXT)`),
    database.prepare("INSERT INTO user VALUES(1), (2)"),
    database.prepare("INSERT INTO project VALUES('project', 'workspace')"),
    database.prepare("INSERT INTO workspace_member VALUES(2, 'workspace', 'owner')"),
    database.prepare("INSERT INTO provider_connection(id) VALUES('connection')"),
  ]);

  await applyTestMigration(
    database,
    await readFile(new URL("../migrations/0058_source_knowledge.sql", import.meta.url), "utf8"),
  );
}
