import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";

import { applyTestMigration } from "./migrations";

export async function initialiseModelPlatformDatabase(database: D1Database): Promise<void> {
  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE workspace (id TEXT PRIMARY KEY)"),
    database.prepare("CREATE TABLE project (id TEXT PRIMARY KEY)"),
    database.prepare("INSERT INTO user VALUES (1), (2)"),
    database.prepare("INSERT INTO workspace VALUES ('workspace'), ('foreign')"),
    database.prepare("CREATE TABLE training_jobs (id TEXT PRIMARY KEY)"),
    database.prepare("CREATE TABLE training_deployments (id TEXT PRIMARY KEY)"),
    database.prepare("CREATE TABLE training_job_events (id TEXT PRIMARY KEY)"),
    database.prepare("CREATE TABLE project_capability (id TEXT PRIMARY KEY, capability_id TEXT)"),
    database.prepare(
      "CREATE TABLE capability_configuration (id TEXT PRIMARY KEY, capability_id TEXT)",
    ),
  ]);

  for (const name of [
    "0052_model_registry",
    "0053_workspace_provider_connections",
    "0054_model_platform",
    "0055_model_provider_claims",
  ]) {
    const migration = await readFile(
      new URL(`../../migrations/${name}.sql`, import.meta.url),
      "utf8",
    );

    await applyTestMigration(database, migration);
  }
}
