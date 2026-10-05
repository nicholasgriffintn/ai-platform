import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { splitMigrationStatements } from "@ngriffin_uk/polychat-utility-server/sql";

export async function applyMigrations(database, migrationsDirectory) {
  const migrations = readdirSync(migrationsDirectory)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && !name.startsWith("9"))
    .sort();

  const statements = migrations.flatMap((migration) =>
    splitMigrationStatements(readFileSync(path.join(migrationsDirectory, migration), "utf8")),
  );

  if (statements.length > 0) {
    await database.batch(statements.map((statement) => database.prepare(statement)));
  }
}
