import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import { ModelAliasRepository } from "../ModelAliasRepository";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repository: ModelAliasRepository;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE model_alias (id TEXT PRIMARY KEY)"),
    database.prepare("INSERT INTO user VALUES (1)"),
    database.prepare("INSERT INTO model_alias VALUES ('alias')"),
  ]);
  const migration = await readFile(
    new URL("../../../../../migrations/0054_model_platform.sql", import.meta.url),
    "utf8",
  );

  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.includes("CREATE TABLE `model_alias_event`")) {
      await database.prepare(statement).run();
    }
  }

  repository = new ModelAliasRepository({ DB: database });
});
afterAll(() => runtime.dispose());

it("orders tied timestamps by insertion so promotion sees the latest request", async () => {
  const base = {
    aliasId: "alias",
    fromRouteId: null,
    toRouteId: "route",
    reason: null,
    gate: null,
    actorUserId: 1,
  };
  const created = await repository.addEvent({ ...base, kind: "created" });
  const requested = await repository.addEvent({ ...base, kind: "requested" });
  const database = await runtime.getD1Database("DB");

  await database.prepare("UPDATE model_alias_event SET created_at = '2026-09-26 12:00:00'").run();
  expect((await repository.listEvents("alias")).map((event) => event.id)).toEqual([
    requested.id,
    created.id,
  ]);
});
