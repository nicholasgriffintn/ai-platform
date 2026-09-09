import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { scheduleDelegationWake } from "~/services/delegations/schedule-wake";
import { TaskService } from "~/services/tasks/TaskService";

import { DelegationRepository } from "../DelegationRepository";
import { TaskRepository } from "../TaskRepository";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repository: DelegationRepository;
let tasks: TaskRepository;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");
  const migration = await readFile(
    new URL("../../../migrations/0037_delegations.sql", import.meta.url),
    "utf8",
  );

  await database.prepare("CREATE TABLE conversation (id TEXT PRIMARY KEY)").run();
  await database.prepare("CREATE TABLE conversation_run (id TEXT PRIMARY KEY)").run();
  await database.prepare("INSERT INTO conversation VALUES ('parent'), ('child')").run();
  await database.prepare("INSERT INTO conversation_run VALUES ('run'), ('other-run')").run();
  await database.prepare(migration.split("--> statement-breakpoint")[0]).run();
  repository = new DelegationRepository({ DB: database });
  const baseline = await readFile(
    new URL("../../../migrations/0000_baseline.sql", import.meta.url),
    "utf8",
  );
  const taskTable = baseline
    .split("--> statement-breakpoint")
    .find((statement) => statement.includes("CREATE TABLE `tasks`"));

  if (!taskTable) {
    throw new Error("Task migration missing");
  }

  await database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)").run();
  await database.prepare("CREATE TABLE project (id TEXT PRIMARY KEY)").run();
  await database.prepare("INSERT INTO user VALUES (1)").run();
  await database.prepare(taskTable).run();
  tasks = new TaskRepository({ DB: database });
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

it("schedules another wake after an earlier child settled before its siblings", async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  const service = new TaskService(
    { TASK_QUEUE: { send, sendBatch: vi.fn(), metrics: vi.fn() } },
    tasks,
  );
  const group = { parentConversationId: "parent", parentRunId: "run" };

  await scheduleDelegationWake(service, { ...group, id: "first" }, 1);
  const queued = await tasks.getPendingTasks();

  expect(queued).toHaveLength(1);
  await tasks.updateTask(queued[0].id, { status: "completed" });
  await scheduleDelegationWake(service, { ...group, id: "second" }, 1);
  expect(send).toHaveBeenCalledTimes(2);
  expect(await tasks.getPendingTasks()).toHaveLength(1);
});
