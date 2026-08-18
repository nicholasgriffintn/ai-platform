import type { D1Database } from "@cloudflare/workers-types";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schema";

export type DatabaseClient = DrizzleD1Database<typeof schema>;

export function createDatabaseClient(database: D1Database): DatabaseClient {
  return drizzle(database, { schema });
}
