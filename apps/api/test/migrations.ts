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
