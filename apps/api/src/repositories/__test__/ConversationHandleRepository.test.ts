import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import { ConversationHandleRepository } from "../ConversationHandleRepository";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repository: ConversationHandleRepository;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");
  const migration = await readFile(
    new URL("../../../migrations/0047_shocking_snowbird.sql", import.meta.url),
    "utf8",
  );

  await database.prepare("CREATE TABLE conversation (id TEXT PRIMARY KEY, user_id INTEGER)").run();
  await database.prepare("CREATE TABLE delegation (id TEXT PRIMARY KEY)").run();
  await database
    .prepare("INSERT INTO conversation VALUES ('parent', 7), ('other-parent', 8)")
    .run();
  await database.prepare("INSERT INTO delegation VALUES ('child'), ('expiring-child')").run();
  for (const statement of migration.split("--> statement-breakpoint")) {
    await database.prepare(statement).run();
  }

  repository = new ConversationHandleRepository({ DB: database });
});

afterAll(async () => {
  await runtime.dispose();
});

it("binds a handle to its delegate and permits only the parent owner to revoke it", async () => {
  await repository.createSpawnHandle({
    id: "handle_child",
    conversationId: "parent",
    delegationId: "child",
    grantedAt: "2026-09-09T00:00:00.000Z",
    expiresAt: null,
  });
  const now = "2026-09-09T00:01:00.000Z";

  expect(await repository.getUsableHandle("handle_child", "expiring-child", now)).toBeNull();
  expect(await repository.revokeForUser("handle_child", 8, now)).toBeNull();
  expect(await repository.getUsableHandle("handle_child", "child", now)).toMatchObject({
    conversationId: "parent",
  });
  expect(await repository.revokeForUser("handle_child", 7, now)).toMatchObject({ revokedAt: now });
  expect(await repository.getUsableHandle("handle_child", "child", now)).toBeNull();
  expect(await repository.listForUser(7)).toEqual([]);
});

it("refuses the exact expiry boundary and all later delivery attempts", async () => {
  const expiresAt = "2026-09-09T00:02:00.000Z";

  await repository.createSpawnHandle({
    id: "handle_expiring-child",
    conversationId: "parent",
    delegationId: "expiring-child",
    grantedAt: "2026-09-09T00:00:00.000Z",
    expiresAt,
  });
  expect(
    await repository.getUsableHandle(
      "handle_expiring-child",
      "expiring-child",
      "2026-09-09T00:01:59.999Z",
    ),
  ).not.toBeNull();
  expect(
    await repository.getUsableHandle("handle_expiring-child", "expiring-child", expiresAt),
  ).toBeNull();
  expect(
    await repository.getUsableHandle(
      "handle_expiring-child",
      "expiring-child",
      "2026-09-10T00:00:00.000Z",
    ),
  ).toBeNull();
});
