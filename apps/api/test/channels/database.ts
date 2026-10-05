import { readFile, readdir } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

import { databaseTestEnvironment } from "../helpers/environment";
import { applyTestMigration } from "../helpers/migrations";

export function channelTestEnvironment(database: D1Database): IEnv {
  const env = databaseTestEnvironment(database, { allowCacheAccess: true });

  env.TASK_QUEUE = {
    metrics: async () => ({ backlogCount: 0, backlogBytes: 0 }),
    send: async () => ({ metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } }),
    sendBatch: async () => ({ metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } }),
  };

  return env;
}

export async function initialiseChannelDatabase(database: D1Database): Promise<void> {
  const names = (await readdir(new URL("../../migrations", import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of names) {
    await applyTestMigration(
      database,
      await readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8"),
    );
  }

  await database.batch([
    database.prepare("INSERT OR IGNORE INTO plans (id) VALUES ('pro')"),
    database.prepare(
      "INSERT INTO user (id, email, plan_id) VALUES (1, 'owner@example.test', 'pro'), (2, 'member@example.test', 'pro'), (3, 'other@example.test', 'pro')",
    ),
    database.prepare(
      "INSERT INTO workspace (id, name, created_by) VALUES ('workspace', 'Workspace', 1)",
    ),
    database.prepare(
      "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ('workspace', 1, 'owner'), ('workspace', 2, 'member')",
    ),
    database.prepare(
      "INSERT INTO project (id, workspace_id, name, created_by) VALUES ('project', 'workspace', 'Project', 1)",
    ),
  ]);
}

export async function channelTestContext(env: IEnv, userId: number) {
  const user = await new UserRepository(env).getUserById(userId);

  if (!user) {
    throw new Error("Test user not found");
  }

  return createServiceContext({ env, user, waitUntil: () => undefined });
}
