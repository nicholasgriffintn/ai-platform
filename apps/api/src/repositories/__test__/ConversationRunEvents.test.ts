import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, expect, it } from "vitest";

import { buildAppendRunEventStatements } from "~/lib/chat-runs/event-statements";

import { ConversationRunRepository } from "../ConversationRunRepository";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});

afterAll(async () => {
  await runtime.dispose();
});

it("retains the latest 500 ordered events and fences a stale writer after takeover", async () => {
  const database = await runtime.getD1Database("DB");
  const migration = await readFile(
    new URL("../../../migrations/0027_clean_nightcrawler.sql", import.meta.url),
    "utf8",
  );
  const eventTable = migration
    .split("--> statement-breakpoint")
    .find((statement) => statement.includes("CREATE TABLE `conversation_run_event`"));

  if (!eventTable) {
    throw new Error("Run event migration missing");
  }

  await database
    .prepare(
      "CREATE TABLE conversation_run (id TEXT PRIMARY KEY, attempt INTEGER, event_sequence INTEGER)",
    )
    .run();
  await database.prepare(eventTable).run();
  await database
    .prepare(
      "CREATE UNIQUE INDEX event_sequence_unique ON conversation_run_event(run_id, sequence)",
    )
    .run();
  await database.prepare("INSERT INTO conversation_run VALUES ('run', 1, 0)").run();
  const repository = new ConversationRunRepository({ DB: database });
  const occurredAt = "2026-09-09T00:00:00.000Z";

  await database
    .prepare(`
    WITH RECURSIVE events(sequence) AS (
      SELECT 1 UNION ALL SELECT sequence + 1 FROM events WHERE sequence < 500
    )
    INSERT INTO conversation_run_event(id, run_id, sequence, protocol_version, attempt, type, occurred_at, data)
    SELECT 'event-' || sequence, 'run', sequence, 1, 1, 'message.created', ?, '{}' FROM events
  `)
    .bind(occurredAt)
    .run();
  await database.prepare("UPDATE conversation_run SET event_sequence = 500 WHERE id = 'run'").run();
  await database.batch(
    Array.from({ length: 7 }, (_, offset) => {
      const sequence = 501 + offset;

      return buildAppendRunEventStatements(database, {
        id: `event-${sequence}`,
        runId: "run",
        type: "message.created",
        occurredAt,
        expectedAttempt: 1,
        data: { messageId: `message-${sequence}` },
      });
    }).flat(),
  );

  expect(await repository.getEventWindow("run")).toEqual({ oldest: 8, latest: 507 });
  const retained = await repository.listEvents("run", 0, 600);

  expect(retained).toHaveLength(500);
  expect(retained.map((event) => event.sequence)).toEqual(
    Array.from({ length: 500 }, (_, index) => index + 8),
  );
  expect(new Set(retained.map((event) => event.id)).size).toBe(500);
  expect(await repository.listEvents("run", 505, 100)).toEqual(retained.slice(-2));
  await database.prepare("UPDATE conversation_run SET attempt = 2 WHERE id = 'run'").run();
  await database.batch(
    buildAppendRunEventStatements(database, {
      id: "stale-event",
      runId: "run",
      type: "message.created",
      occurredAt,
      expectedAttempt: 1,
      data: { messageId: "stale-message" },
    }),
  );
  expect(await repository.getEventWindow("run")).toEqual({ oldest: 8, latest: 507 });
  expect(await repository.listEvents("run", 506, 100)).toEqual(retained.slice(-1));
});
