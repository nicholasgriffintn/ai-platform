import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, expect, it } from "vitest";

import { UsageReservationRepository } from "../UsageReservationRepository";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});

afterAll(async () => {
  await runtime.dispose();
});

it("releases expired credit once and leaves a successor hold intact when maintenance repeats", async () => {
  const database = await runtime.getD1Database("DB");
  const migration = await readFile(
    new URL("../../../migrations/0015_worried_zaladane.sql", import.meta.url),
    "utf8",
  );

  await database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)").run();
  await database.prepare("INSERT INTO user VALUES (7)").run();
  for (const statement of migration
    .split("--> statement-breakpoint")
    .filter((part) =>
      /(?:CREATE TABLE|CREATE UNIQUE INDEX|CREATE INDEX).*`usage_(?:balance|reservation)/.test(
        part,
      ),
    )) {
    await database.prepare(statement).run();
  }

  const repository = new UsageReservationRepository({ DB: database });
  const hold = {
    id: "expired-hold",
    userId: 7,
    period: "2026-09",
    kind: "chat_run" as const,
    refId: "run",
    creditMicros: 1000,
    planId: "pro",
    includedCreditMicros: 10000,
    graceCreditMicros: 0,
    expiresAt: "2026-09-08T00:00:00.000Z",
  };

  await repository.createUserReservationWithBalance(hold);
  const [expired] = await repository.listExpiredHeldReservations(
    "chat_run",
    "2026-09-09T00:00:00.000Z",
    100,
  );

  expect(expired.id).toBe(hold.id);
  expect(
    await repository.finishUserReservationWithBalance("chat_run", "run", "released", expired.id),
  ).toMatchObject({ status: "released" });
  expect(
    await repository.finishUserReservationWithBalance("chat_run", "run", "released", expired.id),
  ).toBeNull();
  expect(
    await database
      .prepare("SELECT reserved_credit_micros FROM usage_balance WHERE user_id = 7")
      .first(),
  ).toEqual({ reserved_credit_micros: 0 });
  await repository.createUserReservationWithBalance({
    ...hold,
    id: "successor-hold",
    expiresAt: "2026-09-10T00:00:00.000Z",
  });
  expect(
    await repository.finishUserReservationWithBalance("chat_run", "run", "released", expired.id),
  ).toBeNull();
  expect(await repository.getReservation("chat_run", "run")).toMatchObject({
    id: "successor-hold",
    status: "held",
  });
  expect(
    await database
      .prepare("SELECT reserved_credit_micros FROM usage_balance WHERE user_id = 7")
      .first(),
  ).toEqual({ reserved_credit_micros: 1000 });
});
