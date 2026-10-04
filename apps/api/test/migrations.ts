import type { D1Database } from "@cloudflare/workers-types";

export async function applyTestMigration(database: D1Database, migration: string): Promise<void> {
  const chunks = migration.includes("--> statement-breakpoint")
    ? migration.split("--> statement-breakpoint")
    : migration.split(/;\s*(?:\r?\n|$)/);
  const statements = chunks
    .filter((statement) => statement.trim())
    .map((statement) => database.prepare(statement));

  if (statements.length > 0) {
    await database.batch(statements);
  }
}
