import { readFile, readdir } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";
import { splitMigrationStatements } from "@ngriffin_uk/polychat-utility-server/sql";

export async function applyTestMigration(database: D1Database, migration: string): Promise<void> {
  const statements = splitMigrationStatements(migration).map((statement) =>
    database.prepare(statement),
  );

  if (statements.length > 0) {
    await database.batch(statements);
  }
}

export async function applyAllTestMigrations(database: D1Database): Promise<void> {
  const directory = new URL("../../migrations/", import.meta.url);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();

  for (const name of names) {
    await applyTestMigration(database, await readFile(new URL(name, directory), "utf8"));
  }
}
