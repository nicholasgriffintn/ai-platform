import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { unstable_splitSqlQuery } = createRequire(
  new URL("../../../../api/package.json", import.meta.url),
)("wrangler");

export async function applyMigrations(database, migrationsDirectory) {
  const migrations = readdirSync(migrationsDirectory)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && !name.startsWith("9"))
    .sort();

  for (const migration of migrations) {
    const statements = unstable_splitSqlQuery(
      readFileSync(path.join(migrationsDirectory, migration), "utf8"),
    );

    for (const statement of statements) {
      await database.prepare(statement).run();
    }
  }
}
