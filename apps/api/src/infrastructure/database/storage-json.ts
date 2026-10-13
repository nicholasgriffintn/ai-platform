import { is, SQL, sql, type SQLWrapper } from "drizzle-orm";

export type StorageRecord<T> = {
  [Key in keyof T]: T[Key] extends SQL<infer Value> ? Value : never;
};

export type StorageChanges<T> = { [Key in keyof T]?: T[Key] | SQL };

export function storageJsonField<T>(column: SQLWrapper, key: string): SQL<T> {
  return sql<T>`${column} -> ${`$.${key}`}`.mapWith({
    mapFromDriverValue(value: string): T {
      return JSON.parse(value);
    },
  });
}

export function storageScalarField<T extends string | number | null>(
  column: SQLWrapper,
  key: string,
): SQL<T> {
  return sql<T>`json_extract(${column}, ${`$.${key}`})`;
}

export function storageBooleanField(column: SQLWrapper, key: string): SQL<boolean> {
  return sql<boolean>`json_extract(${column}, ${`$.${key}`})`.mapWith(Boolean);
}

function storageJsonValue(value: unknown): SQL {
  return is(value, SQL) ? value : sql`json(${JSON.stringify(value)})`;
}

export function storageJsonObject(values: Record<string, unknown>): SQL {
  const fields = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .flatMap(([key, value]) => [sql`${key}`, storageJsonValue(value)]);

  return sql`json_object(${sql.join(fields, sql`, `)})`;
}

export function storageJsonPatch(column: SQLWrapper, values: Record<string, unknown>): SQL {
  const fields = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .flatMap(([key, value]) => [sql`${`$.${key}`}`, storageJsonValue(value)]);

  return fields.length ? sql`json_set(${column}, ${sql.join(fields, sql`, `)})` : sql`${column}`;
}
