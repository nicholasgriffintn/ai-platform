import Database from "better-sqlite3";

interface SqliteStatement {
  query: string;
  params: unknown[];
}

function execute(sqlite: Database.Database, { query, params }: SqliteStatement) {
  const statement = sqlite.prepare(query);

  if (statement.reader) {
    const results = statement.all(...params);

    return { success: true, results, meta: { changes: results.length } };
  }

  const info = statement.run(...params);

  return { success: true, results: [], meta: { changes: info.changes } };
}

export function createSqliteD1(sqlite: Database.Database): D1Database {
  const prepare = (query: string) => ({
    bind: (...params: unknown[]) => {
      const statement = { query, params };

      return {
        ...statement,
        all: async () => execute(sqlite, statement),
        first: async () => execute(sqlite, statement).results[0] ?? null,
        run: async () => execute(sqlite, statement),
      };
    },
  });
  const batch = async (statements: SqliteStatement[]) =>
    sqlite.transaction(() => statements.map((statement) => execute(sqlite, statement)))();

  return { prepare, batch } as unknown as D1Database;
}
