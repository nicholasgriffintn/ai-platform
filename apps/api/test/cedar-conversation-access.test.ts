import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { databaseTestEnvironment } from "./environment";
import { applyEnterpriseIdentityTestMigration } from "./migrations";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let repository: WorkspaceRepository;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await database.exec(`
    CREATE TABLE user (id INTEGER PRIMARY KEY, plan_id TEXT);
    CREATE TABLE conversation (id TEXT PRIMARY KEY, user_id INTEGER, project_id TEXT);
    CREATE TABLE project (id TEXT PRIMARY KEY, workspace_id TEXT);
    CREATE TABLE workspace_member (workspace_id TEXT, user_id INTEGER, role TEXT DEFAULT 'member');
    CREATE TABLE teammate_context (home_conversation_id TEXT, actor_user_id INTEGER);
    INSERT INTO user VALUES (1, 'pro'), (2, 'pro'), (3, 'free');
    INSERT INTO project VALUES ('project-1', 'workspace-1'), ('project-2', 'workspace-2');
    INSERT INTO workspace_member (workspace_id, user_id) VALUES ('workspace-1', 1), ('workspace-1', 3), ('workspace-2', 2);
    INSERT INTO conversation VALUES ('personal', 1, NULL), ('project', 2, 'project-1'), ('foreign', 1, 'project-2'), ('teammate', 2, 'project-1');
    INSERT INTO teammate_context VALUES ('teammate', 2);
  `);
  await applyEnterpriseIdentityTestMigration(database);
  repository = new WorkspaceRepository(databaseTestEnvironment(database));
});

afterAll(async () => {
  await runtime.dispose();
});

describe("Cedar conversation access against stored authority", () => {
  it("requires ownership for personal data and membership plus entitlement for project data", async () => {
    expect(await repository.canAccessConversation("personal", 1)).toBe(true);
    expect(await repository.canAccessConversation("personal", 2)).toBe(false);
    expect(await repository.canAccessConversation("project", 1)).toBe(true);
    expect(await repository.canAccessConversation("project", 2)).toBe(false);
    expect(await repository.canAccessConversation("project", 3)).toBe(false);
    expect(await repository.canAccessConversation("foreign", 1)).toBe(false);
    expect(await repository.canAccessConversation("teammate", 1)).toBe(false);
    expect(await repository.canAccessConversation("missing", 1)).toBe(false);
  });

  it("denies the next request immediately after membership revocation", async () => {
    expect(await repository.canAccessConversation("project", 1)).toBe(true);
    await database
      .prepare("DELETE FROM workspace_member WHERE workspace_id = ? AND user_id = ?")
      .bind("workspace-1", 1)
      .run();
    expect(await repository.canAccessConversation("project", 1)).toBe(false);
  });
});
