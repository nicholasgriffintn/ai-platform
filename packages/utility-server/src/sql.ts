export function escapeSqlLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

const SIMPLE_SQL_LITERAL_PATTERN = /^[A-Za-z0-9_.:-]+$/;

export function isSimpleSqlLiteral(value: string): boolean {
  return SIMPLE_SQL_LITERAL_PATTERN.test(value);
}

export function splitMigrationStatements(migration: string): string[] {
  const separator = migration.includes("--> statement-breakpoint")
    ? "--> statement-breakpoint"
    : ";";

  return migration
    .split(separator)
    .map((statement) => statement.trim())
    .filter(Boolean);
}
