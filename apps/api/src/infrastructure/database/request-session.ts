import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

import type { IEnv } from "~/types";

export function createRequestDatabase(database: D1Database): D1Database {
  const session = database.withSession("first-primary");

  return {
    prepare: (query: string) => session.prepare(query),
    batch<T = unknown>(statements: D1PreparedStatement[]) {
      return session.batch<T>(statements);
    },
    exec: (query: string) => database.exec(query),
    withSession: (constraintOrBookmark) => database.withSession(constraintOrBookmark),
    dump: () => database.dump(),
  };
}

export function withRequestDatabase(env: IEnv): IEnv {
  return env.DB ? { ...env, DB: createRequestDatabase(env.DB) } : env;
}
