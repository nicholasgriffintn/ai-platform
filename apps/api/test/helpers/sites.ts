import { readFile, readdir } from "node:fs/promises";

import type { Miniflare } from "miniflare";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";

import { browserTestUser } from "../fixtures/computer-use";
import { testSite } from "../fixtures/sites";
import { databaseTestEnvironment } from "./environment";
import { applyTestMigration } from "./migrations";

export async function createSitesTestContext(runtime: Miniflare): Promise<ServiceContext> {
  const database = await runtime.getD1Database("DB");

  const migrations = new URL("../../migrations/", import.meta.url);

  for (const name of (await readdir(migrations))
    .filter((filename) => filename.endsWith(".sql"))
    .sort()) {
    await applyTestMigration(database, await readFile(new URL(name, migrations), "utf8"));
  }

  await database.exec(`
    INSERT OR IGNORE INTO plans (id) VALUES ('pro');
    INSERT INTO user (id, email, plan_id) VALUES (1, 'one@example.test', 'pro'), (2, 'two@example.test', 'pro');
    INSERT INTO conversation (id, user_id) VALUES ('conversation', 1);
    INSERT INTO workspace (id, name, created_by) VALUES ('workspace', 'Test', 2);
    INSERT INTO project (id, workspace_id, name, created_by) VALUES ('project', 'workspace', 'Test', 2);
    INSERT INTO project_capability (id, project_id, kind, capability_id, created_by) VALUES ('sites', 'project', 'app', 'featured-sites', 2);
  `);

  const env = databaseTestEnvironment(database);

  Object.defineProperty(env, "CACHE", { value: await runtime.getKVNamespace("CACHE") });

  return createServiceContext({ env, user: browserTestUser, connectorRunId: "conversation" });
}

export async function resetSitesTestData(context: ServiceContext): Promise<void> {
  await context.env.DB.exec(`
    DELETE FROM composio_connector_session;
    DELETE FROM output;
    DELETE FROM source;
    DELETE FROM workspace_member;
    INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ('workspace', 1, 'member'), ('workspace', 2, 'owner');
    DELETE FROM project_capability WHERE kind = 'recipe';
    UPDATE project_capability SET excluded = 0;
  `);
}

export async function saveTestSite(
  context: ServiceContext,
  projectId: string | null = null,
  userId = 1,
) {
  return context.repositories.outputs.createOutput({
    id: testSite.id,
    createdByUserId: userId,
    projectId,
    capabilityId: "featured-sites",
    kind: "site",
    title: testSite.title,
    content: {
      brief: testSite.brief,
      plan: testSite.plan,
      project: testSite.project,
      turns: [],
      issues: [],
    },
  });
}
