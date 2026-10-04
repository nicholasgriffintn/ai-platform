import { readFile } from "node:fs/promises";

import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { runKnowledgeSync } from "~/modules/sources/application/knowledge-sync-run";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

import { databaseTestEnvironment } from "./environment";
import { testUser } from "./users";

const mocks = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn() }));

vi.mock("~/modules/workspaces/application/access", async (original) => ({
  ...(await original<typeof import("~/modules/workspaces/application/access")>()),
  requireProjectCapabilityAccess: mocks.access,
}));
vi.mock("~/modules/apps/application/connectors/operations", () => ({
  executeRecipeConnectorOperation: mocks.read,
}));

import { normaliseConfluencePage } from "~/modules/sources/application/confluence-page";
import { KnowledgeSyncRepository } from "~/modules/sources/infrastructure/KnowledgeSyncRepository";
import { SourceSearchRepository } from "~/modules/sources/infrastructure/SourceSearchRepository";

import { applyTestMigration } from "./migrations";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repository: KnowledgeSyncRepository;

beforeAll(async () => {
  const DB = await runtime.getD1Database("DB");

  await DB.batch([
    DB.prepare("CREATE TABLE user(id INTEGER PRIMARY KEY)"),
    DB.prepare("CREATE TABLE project(id TEXT PRIMARY KEY)"),
    DB.prepare(`CREATE TABLE provider_connection(id TEXT PRIMARY KEY, user_id INTEGER DEFAULT 1,
      provider TEXT DEFAULT 'confluence', kind TEXT DEFAULT 'recipe_connector_account',
      status TEXT DEFAULT 'connected', external_id TEXT DEFAULT 'dummy-account')`),
    DB.prepare(`CREATE TABLE source(id TEXT PRIMARY KEY, created_by_user_id INTEGER, project_id TEXT,
      connection_id TEXT, kind TEXT, title TEXT, status TEXT, content TEXT, provider TEXT,
      external_uri TEXT, metadata TEXT DEFAULT '{}', updated_at TEXT)`),
    DB.prepare("INSERT INTO user VALUES(1)"),
    DB.prepare("INSERT INTO project VALUES('project')"),
    DB.prepare("INSERT INTO provider_connection(id) VALUES('connection')"),
  ]);
  for (const file of ["0058_source_knowledge.sql", "0059_confluence_knowledge_sync.sql"]) {
    await applyTestMigration(
      DB,
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  }

  repository = new KnowledgeSyncRepository({ DB });
});
afterAll(() => runtime.dispose());

it("rechecks authority after the upstream read and pauses without publishing a revoked result", async () => {
  const DB = await runtime.getD1Database("DB");

  await repository.create({
    id: "worker",
    userId: 1,
    projectId: "project",
    connectionId: "connection",
    title: "Worker runbooks",
    pages: [{ pageId: "3", readParameters: {} }],
    intervalMinutes: 60,
  });
  const user = vi.spyOn(UserRepository.prototype, "getUserById").mockResolvedValue(testUser(1));

  mocks.access
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(
      new AssistantError("Access revoked", ErrorType.AUTHORISATION_ERROR, 403),
    );
  mocks.read.mockResolvedValue({
    data: {
      id: "3",
      title: "Private runbook",
      status: "current",
      version: { number: 1 },
      body: { storage: { value: "<p>Private instructions</p>" } },
    },
  });
  try {
    const env = databaseTestEnvironment(DB);

    await expect(runKnowledgeSync(env, "worker", 1, 1)).rejects.toMatchObject({ statusCode: 502 });
    expect(await repository.get("worker")).toMatchObject({
      status: "paused",
      cursor: 0,
      last_successful_at: null,
      generation: 2,
    });
    expect(
      await DB.prepare(
        "SELECT count(*) AS count FROM source WHERE title = 'Private runbook'",
      ).first(),
    ).toEqual({ count: 0 });
    await runKnowledgeSync(env, "worker", 1, 1);
    expect(mocks.read).toHaveBeenCalledOnce();
  } finally {
    user.mockRestore();
  }
});

it("commits sources and checkpoints atomically, rejects old leases and records freshness only at cycle completion", async () => {
  await repository.create({
    id: "sync",
    userId: 1,
    projectId: "project",
    connectionId: "connection",
    title: "Runbooks",
    pages: [
      { pageId: "1", readParameters: {} },
      { pageId: "2", readParameters: {} },
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
    title: "Runbook",
    content: "Rollback instructions",
    status: "available" as const,
    externalUri: "https://example.test/wiki/1",
    upstreamRevision: 3,
  };

  expect(await repository.commitPage(initial, "first", "source1", "1", page, 2)).toBe(true);
  expect(await repository.get("sync")).toMatchObject({
    cursor: 1,
    generation: 1,
    last_successful_at: null,
  });
  expect(
    await repository.commitPage(
      initial,
      "first",
      "source1",
      "1",
      { ...page, content: "Old replay" },
      2,
    ),
  ).toBe(false);
  await repository.release("sync", "first", "Temporary failure");
  expect(await repository.claim("sync", 1, "retry")).toBe(true);
  const resumed = await repository.get("sync");

  if (!resumed) {
    throw new Error("Missing resumed fixture");
  }

  expect(await repository.commitPage(resumed, "retry", "source2", "2", page, 2)).toBe(true);
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
    await repository.commitPage(
      current,
      "current",
      "source1",
      "1",
      { ...page, content: "After pause" },
      2,
    ),
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
  const search = new SourceSearchRepository({ DB });

  expect(await search.lexical("project", '"Rollback"')).toEqual([]);
});

it("normalises published storage pages, validates identity and preserves explicit removal states", () => {
  const data = {
    id: "1",
    title: "Runbook",
    status: "current",
    version: { number: 4 },
    body: {
      storage: {
        value: "<p>Restart &amp; verify</p><script>ignored()</script><pre>service restart</pre>",
      },
    },
    _links: { base: "https://example.test/wiki", webui: "/wiki/pages/1" },
  };

  expect(normaliseConfluencePage({ data }, "1")).toMatchObject({
    content: "Restart & verify\nservice restart",
    upstreamRevision: 4,
    externalUri: "https://example.test/wiki/pages/1",
  });
  expect(() => normaliseConfluencePage({ data }, "2")).toThrow("different page");
  expect(() => normaliseConfluencePage({ ...data, body: undefined }, "1")).toThrow("storage body");
  expect(normaliseConfluencePage({ ...data, status: "trashed" }, "1").status).toBe("archived");
});
