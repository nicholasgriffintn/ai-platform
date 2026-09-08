import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import { DelegationRepository } from "../DelegationRepository";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repository: DelegationRepository;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");
  const migration = await readFile(
    new URL("../../../migrations/0043_steady_mulholland_black.sql", import.meta.url),
    "utf8",
  );

  await database.prepare("CREATE TABLE conversation (id TEXT PRIMARY KEY)").run();
  await database.prepare("CREATE TABLE conversation_run (id TEXT PRIMARY KEY)").run();
  await database.prepare("INSERT INTO conversation VALUES ('parent'), ('child')").run();
  await database.prepare("INSERT INTO conversation_run VALUES ('run'), ('other-run')").run();
  await database.prepare(migration.split("--> statement-breakpoint")[0]).run();
  repository = new DelegationRepository({ DB: database });
});

afterAll(async () => {
  await runtime.dispose();
});

it("enforces concurrent fan-out at insertion and frees capacity only when a run settles", async () => {
  const params = {
    parentConversationId: "parent",
    childConversationId: "child",
    parentRunId: "run",
    depth: 1,
    teammateId: "teammate",
    goal: "Review the change",
    waitFor: "all" as const,
    budget: {
      maxCreditMicros: 100_000,
      maxSteps: 10,
      deadline: new Date(Date.now() + 60_000).toISOString(),
    },
  };
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) =>
      repository.createDelegation({ ...params, id: `delegation-${index}` }),
    ),
  );

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
  expect(await repository.countLiveForParent("parent", "run")).toBe(3);
  const [first] = await repository.listByParentRunId("run");

  expect(first.state).toBe("queued");
  expect(await repository.claimDelegation(first.id)).toMatchObject({ state: "running" });
  expect(await repository.claimDelegation(first.id)).toBeNull();
  await repository.updateState(first.id, "done", { summary: "Complete", outputIds: [] });
  expect(await repository.expireIfLive(first.id, "Deadline passed")).toBeNull();
  expect(await repository.getById(first.id)).toMatchObject({ state: "done" });
  expect(await repository.createDelegation({ ...params, id: "replacement" })).toMatchObject({
    state: "queued",
  });
  await expect(repository.createDelegation({ ...params, id: "over-limit" })).rejects.toThrow(
    "limit",
  );
  expect(await repository.cancelIfLive("replacement")).toMatchObject({ state: "cancelled" });
  expect(
    await repository.updateState("replacement", "done", { summary: "Late result", outputIds: [] }),
  ).toBeNull();
  expect(await repository.getById("replacement")).toMatchObject({ state: "cancelled" });
  await expect(
    repository.createDelegation({ ...params, id: "nested", parentRunId: "other-run", depth: 2 }),
  ).rejects.toThrow("depth");
  await expect(
    repository.createDelegation({
      ...params,
      id: "nested-with-forged-depth",
      parentConversationId: "child",
      parentRunId: "other-run",
    }),
  ).rejects.toThrow("depth");
  expect(
    await repository.createDelegation({ ...params, id: "other", parentRunId: "other-run" }),
  ).toMatchObject({ state: "queued" });
});
