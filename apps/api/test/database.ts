import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";

import { applyAllTestMigrations } from "./migrations";

export async function createMigratedTestDatabase() {
  const runtime = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('test'); } }",
    compatibilityDate: "2026-08-01",
    d1Databases: ["DB"],
  });
  const database: D1Database = await runtime.getD1Database("DB");

  await applyAllTestMigrations(database);

  return { runtime, database };
}
