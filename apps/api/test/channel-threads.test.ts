import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";
import { toSortableDecimalIdentifier } from "@ngriffin_uk/polychat-utility-core";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { ChannelThreadRepository } from "~/modules/channels/infrastructure/ChannelThreadRepository";

import { databaseTestEnvironment } from "./environment";
import { applyTestMigration } from "./migrations";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let threads: ChannelThreadRepository;
let bindings: ChannelBindingRepository;
let bindingId: string;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE teammates (id TEXT PRIMARY KEY)"),
    database.prepare("INSERT INTO user VALUES (42)"),
  ]);
  await applyTestMigration(
    database,
    await readFile(new URL("../migrations/0034_channel_bindings.sql", import.meta.url), "utf8"),
  );
  await database
    .prepare(
      "ALTER TABLE channel_binding ADD COLUMN interaction_mode TEXT NOT NULL DEFAULT 'automated'",
    )
    .run();
  await database
    .prepare(
      "INSERT INTO channel_binding (id, channel, scope_type, scope_id, external_id, created_by) VALUES ('legacy', 'slack', 'personal', '42', 'COLD', 42)",
    )
    .run();
  await applyTestMigration(
    database,
    await readFile(new URL("../migrations/0058_channel_threads.sql", import.meta.url), "utf8"),
  );
  const env = databaseTestEnvironment(database);

  threads = new ChannelThreadRepository(env);
  bindings = new ChannelBindingRepository(env);
  const binding = await bindings.create({
    channel: "slack",
    scopeType: "personal",
    scopeId: "42",
    externalId: "C123",
    workspaceId: "T123",
    allowedSenderIds: ["U9"],
    replyMode: "mentions",
    interactionMode: "direct",
    createdByUserId: 42,
  });

  expect(binding).not.toBeNull();
  bindingId = binding.id;
});
afterAll(() => runtime.dispose());

it("isolates workspace namespaces and disables bindings without explicit sender authority", async () => {
  expect((await bindings.getById("legacy"))?.enabled).toBe(false);
  expect(await bindings.findByExternalId("slack", "C123", "TOTHER")).toBeNull();
  const other = await bindings.create({
    channel: "slack",
    scopeType: "personal",
    scopeId: "42",
    externalId: "C123",
    workspaceId: "TOTHER",
    allowedSenderIds: ["U9"],
    replyMode: "mentions",
    interactionMode: "direct",
    createdByUserId: 42,
  });

  expect(other?.id).not.toBe(bindingId);
  await expect(
    bindings.create({
      channel: "slack",
      scopeType: "personal",
      scopeId: "42",
      externalId: "C123",
      workspaceId: "T123",
      allowedSenderIds: ["U9"],
      replyMode: "mentions",
      interactionMode: "direct",
      createdByUserId: 42,
    }),
  ).rejects.toThrow();
});

it("keeps mute and stop fences durable across duplicate controls, old events and resume", async () => {
  const target = { bindingId, bindingRevision: 1, threadId: "171.1" };
  const first = toSortableDecimalIdentifier("171.1");

  expect(await threads.admit({ ...target, messageOrder: first, activate: false })).toBeNull();
  expect((await threads.admit({ ...target, messageOrder: first, activate: true }))?.revision).toBe(
    1,
  );

  const muted = await threads.control({
    ...target,
    messageOrder: toSortableDecimalIdentifier("172.1"),
    action: "mute",
  });

  expect(muted).toMatchObject({ muted: true, revision: 2 });
  expect(
    await threads.control({
      ...target,
      messageOrder: toSortableDecimalIdentifier("172.1"),
      action: "mute",
    }),
  ).toBeNull();
  expect(
    await threads.admit({
      ...target,
      messageOrder: toSortableDecimalIdentifier("173.1"),
      activate: true,
    }),
  ).toBeNull();
  expect(await threads.control({ ...target, messageOrder: first, action: "resume" })).toBeNull();

  const resumed = await threads.control({
    ...target,
    messageOrder: toSortableDecimalIdentifier("174.1"),
    action: "resume",
  });

  expect(resumed).toMatchObject({ muted: false, revision: 3 });
  expect(
    await threads.admit({
      ...target,
      messageOrder: toSortableDecimalIdentifier("173.1"),
      activate: true,
    }),
  ).toBeNull();
  expect(
    (
      await threads.admit({
        ...target,
        messageOrder: toSortableDecimalIdentifier("175.1"),
        activate: false,
      })
    )?.revision,
  ).toBe(3);
  expect(
    await threads.control({
      ...target,
      messageOrder: toSortableDecimalIdentifier("176.1"),
      action: "stop",
    }),
  ).toMatchObject({ muted: false, revision: 4 });
  const changed = await bindings.update({
    id: bindingId,
    userId: 42,
    expectedRevision: 1,
    allowedSenderIds: ["U42"],
    replyMode: "all",
    enabled: true,
  });

  expect(changed?.revision).toBe(2);
  expect(
    await bindings.update({
      id: bindingId,
      userId: 42,
      expectedRevision: 1,
      allowedSenderIds: ["U9"],
      replyMode: "all",
      enabled: true,
    }),
  ).toBeNull();
  expect(
    await threads.admit({
      ...target,
      messageOrder: toSortableDecimalIdentifier("177.1"),
      activate: true,
    }),
  ).toBeNull();
  await bindings.delete(bindingId, 42);
  expect(await threads.get(bindingId, "171.1")).toBeNull();
});
