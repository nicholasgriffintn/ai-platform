import { Miniflare } from "miniflare";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { PendingEmbeddingDocument } from "~/modules/apps/application/embeddings/document";

import {
  initialiseSourceKnowledgeDatabase,
  sourceKnowledgeRuntimeOptions,
} from "../../../../../test/fixtures/sources/database";
import { projectKnowledgeTarget } from "../../application/knowledge-index";
import { SourceSearchRepository } from "../SourceSearchRepository";

let runtime: Miniflare;
let repository: SourceSearchRepository;

beforeEach(async () => {
  runtime = new Miniflare(sourceKnowledgeRuntimeOptions);
  const DB = await runtime.getD1Database("DB");

  await initialiseSourceKnowledgeDatabase(DB);
  repository = new SourceSearchRepository({ DB });
});
afterEach(() => runtime.dispose());

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

it("hydrates only current project passages and immediately excludes edited, archived or deleted sources", async () => {
  const database = await runtime.getD1Database("DB");

  await database.batch(
    ["project", "foreign", "deleted"].map((project) =>
      database
        .prepare(
          "INSERT INTO source(id, created_by_user_id, project_id, kind, title, content, status) VALUES (?, 1, ?, 'text', 'Runbook', 'Rollback deployment', 'available')",
        )
        .bind(project, project),
    ),
  );

  for (const id of ["project", "foreign", "deleted"]) {
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
  await database.prepare("UPDATE source SET status = 'archived' WHERE id = 'foreign'").run();
  expect(await repository.hydrate("foreign", ["foreign"])).toEqual([]);
  expect(await repository.lexical("foreign", '"Rollback"')).toEqual([]);
  expect((await repository.lexical("deleted", '"Rollback"')).map((p) => p.sourceId)).toEqual([
    "deleted",
  ]);
  await database.prepare("DELETE FROM source WHERE id = 'deleted'").run();
  expect(await repository.hydrate("deleted", ["deleted"])).toEqual([]);
  expect(await repository.lexical("deleted", '"Rollback"')).toEqual([]);
  expect((await repository.stale("deleted")).map((d) => d.id)).toEqual(["deleted"]);
});
