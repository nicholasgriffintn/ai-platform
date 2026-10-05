import { readFile, readdir } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";

export async function applyTestMigration(database: D1Database, migration: string): Promise<void> {
  const statements = migration
    .split("--> statement-breakpoint")
    .filter((statement) => statement.trim())
    .map((statement) => database.prepare(statement));

  if (statements.length > 0) {
    await database.batch(statements);
  }
}

export async function applyAllTestMigrations(database: D1Database): Promise<void> {
  const directory = new URL("../migrations/", import.meta.url);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();

  for (const name of names) {
    await applyTestMigration(database, await readFile(new URL(name, directory), "utf8"));
  }
}

export async function applyEnterpriseIdentityTestMigration(database: D1Database): Promise<void> {
  await applyTestMigration(
    database,
    await readFile(new URL("../migrations/0059_enterprise_identity.sql", import.meta.url), "utf8"),
  );
}
