import { fileURLToPath } from "node:url";

import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import { databaseTestEnvironment } from "../environment";
import { applyMigrations } from "./migrations.mjs";

export const integrationTestUser: IUser = {
  id: 7,
  name: "Reviewer",
  avatar_url: null,
  email: "reviewer@example.test",
  github_username: "reviewer",
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

export async function createIntegrationTestContext() {
  const runtime = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('test'); } }",
    compatibilityDate: "2026-08-01",
    d1Databases: ["DB"],
  });
  const database: D1Database = await runtime.getD1Database("DB");

  await applyMigrations(database, fileURLToPath(new URL("../../migrations", import.meta.url)));

  await database
    .prepare("INSERT INTO user (id, email, plan_id) VALUES (7, 'reviewer@example.test', 'pro')")
    .run();
  await database
    .prepare(
      "INSERT INTO workspace (id, name, created_by) VALUES ('workspace-1', 'Engineering', 7)",
    )
    .run();
  await database
    .prepare(
      "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ('workspace-1', 7, 'owner')",
    )
    .run();
  await database
    .prepare(
      "INSERT INTO project (id, workspace_id, name, created_by) VALUES ('project-1', 'workspace-1', 'Product', 7)",
    )
    .run();
  const env = databaseTestEnvironment(database);

  Object.defineProperty(env, "CACHE", { value: undefined });
  const context = createServiceContext({
    env,
    user: integrationTestUser,
  });

  return { runtime, database, context };
}
