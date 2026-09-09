import type { D1Database } from "@cloudflare/workers-types";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schema";

export type DatabaseClient = DrizzleD1Database<typeof schema>;

const clients = new WeakMap<D1Database, DatabaseClient>();

export function createDatabaseClient(database: D1Database): DatabaseClient {
  const existing = clients.get(database);

  if (existing) {
    return existing;
  }

  const client = drizzle(database, { schema });

  clients.set(database, client);

  return client;
}
