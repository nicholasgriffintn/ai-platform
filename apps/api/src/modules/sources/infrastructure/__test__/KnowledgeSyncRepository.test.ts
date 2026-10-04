import { Miniflare } from "miniflare";
import { afterEach, beforeEach, expect, it } from "vitest";

import {
  initialiseSourceKnowledgeDatabase,
  sourceKnowledgeRuntimeOptions,
} from "../../../../../test/fixtures/sources/database";
import { KnowledgeSyncRepository } from "../KnowledgeSyncRepository";

let runtime: Miniflare;
let repository: KnowledgeSyncRepository;

beforeEach(async () => {
  runtime = new Miniflare(sourceKnowledgeRuntimeOptions);
  const DB = await runtime.getD1Database("DB");

  await initialiseSourceKnowledgeDatabase(DB);
  repository = new KnowledgeSyncRepository({ DB });
});
afterEach(() => runtime.dispose());

it("commits sources and checkpoints atomically, rejects old leases and records freshness only at cycle completion", async () => {
  await repository.create({
    id: "sync",
    userId: 1,
    projectId: "project",
    connectionId: "connection",
    recipeId: "confluence-project-knowledge",
    integrationId: "confluence",
    title: "Runbooks",
    resources: [
      { resourceId: "1", readParameters: {} },
      { resourceId: "2", readParameters: {} },
    ],
    intervalMinutes: 60,
  });
  const initial = await repository.get("sync");

  if (!initial) {
    throw new Error("Missing sync fixture");
  }

  expect(await repository.claim("sync", 1, "first")).toBe(true);
  expect(await repository.claim("sync", 1, "other")).toBe(false);
  const page = {
    sourceId: "source1",
    resourceId: "1",
    resourceCount: 2,
    provider: "confluence",
    title: "Runbook",
    content: "Rollback instructions",
    status: "available" as const,
    externalUri: "https://example.test/wiki/1",
    upstreamRevision: 3,
  };

  expect(await repository.commitResource(initial, "first", page)).toBe(true);
  expect(await repository.get("sync")).toMatchObject({
    cursor: 1,
    generation: 1,
    last_successful_at: null,
  });
  expect(
    await repository.commitResource(initial, "first", { ...page, content: "Old replay" }),
  ).toBe(false);
  await repository.release("sync", "first", "Temporary failure");
  expect(await repository.claim("sync", 1, "retry")).toBe(true);
  const resumed = await repository.get("sync");

  if (!resumed) {
    throw new Error("Missing resumed fixture");
  }

  expect(
    await repository.commitResource(resumed, "retry", {
      ...page,
      sourceId: "source2",
      resourceId: "2",
    }),
  ).toBe(true);
  expect(await repository.get("sync")).toMatchObject({
    cursor: 0,
    generation: 2,
    last_error: null,
  });
  expect((await repository.get("sync"))?.last_successful_at).toBeTruthy();
  await repository.release("sync", "retry", null);
  expect(await repository.claim("sync", 1, "old-generation")).toBe(false);
  expect(await repository.claim("sync", 2, "current")).toBe(true);
  const current = await repository.get("sync");

  if (!current) {
    throw new Error("Missing current fixture");
  }

  await repository.control("sync", "pause");
  expect(
    await repository.commitResource(current, "current", { ...page, content: "After pause" }),
  ).toBe(false);
  const DB = await runtime.getD1Database("DB");

  expect(await DB.prepare("SELECT content FROM source WHERE id = 'source1'").first()).toEqual({
    content: page.content,
  });
  await repository.control("sync", "resume");
  const active = await repository.get("sync");

  if (!active) {
    throw new Error("Missing active fixture");
  }

  await repository.claim("sync", active.generation, "archive");
  await repository.markUnavailable(active, "archive", "source1");
  expect(
    await DB.prepare("SELECT status, content FROM source WHERE id = 'source1'").first(),
  ).toEqual({ status: "archived", content: page.content });
});
