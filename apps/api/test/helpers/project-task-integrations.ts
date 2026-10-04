import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import z from "zod/v4";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import { databaseTestEnvironment } from "../environment";

const snapshotSchema = z.object({
  tables: z.record(
    z.string(),
    z.object({
      columns: z.record(
        z.string(),
        z.object({
          name: z.string(),
          type: z.string(),
          primaryKey: z.boolean(),
          notNull: z.boolean(),
          default: z.union([z.string(), z.number(), z.boolean()]).optional(),
        }),
      ),
      foreignKeys: z.record(
        z.string(),
        z.object({
          tableTo: z.string(),
          columnsFrom: z.array(z.string()),
          columnsTo: z.array(z.string()),
          onDelete: z.string(),
          onUpdate: z.string(),
        }),
      ),
    }),
  ),
});

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
  const snapshot = snapshotSchema.parse(
    JSON.parse(
      await readFile(new URL("../../migrations/meta/0057_snapshot.json", import.meta.url), "utf8"),
    ),
  );
  const tables = [
    "user",
    "oauth_account",
    "workspace",
    "workspace_member",
    "project",
    "conversation",
    "message",
    "project_capability",
    "project_task",
    "source",
    "provider_connection",
    "workspace_audit_record",
    "output",
    "composio_connector_session",
    "activity_record",
  ];

  for (const name of tables) {
    const table = snapshot.tables[name];

    if (!table) {
      throw new Error(`Missing fixture schema: ${name}`);
    }

    const columns = Object.values(table.columns).map(
      (column) =>
        `"${column.name}" ${column.type}${column.primaryKey ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}${column.default === undefined ? "" : ` DEFAULT ${column.default}`}`,
    );

    const foreignKeys = Object.values(table.foreignKeys)
      .filter((key) => tables.includes(key.tableTo))
      .map(
        (key) =>
          `FOREIGN KEY (${key.columnsFrom.map((column) => `"${column}"`).join(", ")}) REFERENCES "${key.tableTo}" (${key.columnsTo.map((column) => `"${column}"`).join(", ")}) ON DELETE ${key.onDelete} ON UPDATE ${key.onUpdate}`,
      );

    await database
      .prepare(`CREATE TABLE "${name}" (${[...columns, ...foreignKeys].join(", ")})`)
      .run();
  }

  const migration = await readFile(
    new URL("../../migrations/0058_project_task_integrations.sql", import.meta.url),
    "utf8",
  );

  for (const statement of migration
    .split("--> statement-breakpoint")
    .filter((entry) => entry.trim())) {
    await database.prepare(statement).run();
  }

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
