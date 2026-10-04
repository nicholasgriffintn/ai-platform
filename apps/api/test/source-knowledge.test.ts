import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { PendingEmbeddingDocument } from "~/modules/apps/application/embeddings/document";
import { projectKnowledgeTarget } from "~/modules/sources/application/knowledge-index";
import { SourceSearchRepository } from "~/modules/sources/infrastructure/SourceSearchRepository";

import { applyTestMigration } from "./migrations";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repository: SourceSearchRepository;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await database
    .prepare(`CREATE TABLE source (
    id TEXT PRIMARY KEY, created_by_user_id INTEGER, project_id TEXT, kind TEXT,
    title TEXT, content TEXT, status TEXT, external_uri TEXT, updated_at TEXT, metadata TEXT DEFAULT '{}'
  )`)
    .run();
  await applyTestMigration(
    database,
    await readFile(new URL("../migrations/0058_source_knowledge.sql", import.meta.url), "utf8"),
  );
  repository = new SourceSearchRepository({ DB: database });
  await database.batch([
    database.prepare("CREATE TABLE user(id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE project(id TEXT PRIMARY KEY, workspace_id TEXT)"),
    database.prepare(
      "CREATE TABLE workspace_member(user_id INTEGER, workspace_id TEXT, role TEXT)",
    ),
    database.prepare("CREATE TABLE tasks(task_type TEXT, status TEXT, task_data TEXT)"),
    database.prepare("INSERT INTO user VALUES(1), (2)"),
    database.prepare("INSERT INTO project VALUES('project', 'workspace')"),
    database.prepare("INSERT INTO workspace_member VALUES(2, 'workspace', 'owner')"),
  ]);
});

afterAll(() => runtime.dispose());

it("uses current project membership for indexing and suppresses pending duplicates", async () => {
  const database = await runtime.getD1Database("DB");

  await database
    .prepare(
      "INSERT INTO source(id, created_by_user_id, project_id, kind, title, content, status) VALUES ('pending', 1, 'project', 'text', 'Pending', 'New material', 'available')",
    )
    .run();
  expect(await repository.maintenance(false, false)).toEqual([
    { id: "pending", user_id: 2, project_id: "project" },
  ]);
  await database
    .prepare(
      `INSERT INTO tasks VALUES('source_knowledge_index', 'queued', '{"sourceId":"pending"}')`,
    )
    .run();
  expect(await repository.maintenance(false, false)).toEqual([]);
});

it("hydrates only current authorised project passages and invalidates edits before reindexing", async () => {
  const database = await runtime.getD1Database("DB");

  await database.batch(
    ["project", "foreign"].map((project) =>
      database
        .prepare(
          "INSERT INTO source(id, created_by_user_id, project_id, kind, title, content, status) VALUES (?, 1, ?, 'text', 'Runbook', 'Rollback deployment', 'available')",
        )
        .bind(project, project),
    ),
  );

  for (const id of ["project", "foreign"]) {
    const source = await repository.getSource(id);

    if (!source) {
      throw new Error("Missing source fixture");
    }

    const document: PendingEmbeddingDocument = {
      documentId: id,
      logicalId: id,
      content: source.content ?? "",
      title: source.title,
      chunks: [{ id: id, vectorId: id, index: 0, content: source.content ?? "" }],
    };

    await repository.prepare(source, document, projectKnowledgeTarget());
    await repository.prepare(source, document, projectKnowledgeTarget());
    expect(await repository.claim(id, id, "lexical")).toBe(true);
    expect(await repository.claim(id, "concurrent", "lexical")).toBe(false);
    expect(await repository.activate(id, id)).toBe(true);
    await repository.release(id, id);
  }

  expect((await repository.lexical("project", '"Rollback"')).map((p) => p.sourceId)).toEqual([
    "project",
  ]);
  expect(
    (await repository.hydrate("project", ["project", "foreign"])).map((p) => p.sourceId),
  ).toEqual(["project"]);
  await database
    .prepare("UPDATE source SET content = 'New instructions' WHERE id = 'project'")
    .run();
  expect(await repository.lexical("project", '"Rollback"')).toEqual([]);
  expect(await repository.hydrate("project", ["project"])).toEqual([]);
  expect(await repository.activate("project", "project")).toBe(false);
  expect((await repository.stale("project")).map((d) => d.id)).toEqual(["project"]);
  expect(await repository.claim("project", "cleanup", "stale")).toBe(true);
  await repository.removeStale("project", "cleanup");
  expect(await repository.chunks("project")).toEqual([]);
});

it("keeps deleted and archived sources out of both retrieval paths", async () => {
  const database = await runtime.getD1Database("DB");

  await database.prepare("UPDATE source SET status = 'archived' WHERE id = 'foreign'").run();
  expect(await repository.hydrate("foreign", ["foreign"])).toEqual([]);
  expect(await repository.lexical("foreign", '"Rollback"')).toEqual([]);
  await database.prepare("DELETE FROM source WHERE id = 'foreign'").run();
  expect((await repository.stale("foreign")).map((d) => d.id)).toEqual(["foreign"]);
});
