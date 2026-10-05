import type { D1Database } from "@cloudflare/workers-types";
import { toFtsQuery } from "@ngriffin_uk/polychat-utility-server/search-ranking";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ContentExtractResult } from "~/modules/apps/application/ports/content-extract";
import { maybeStoreExtractedKnowledge } from "~/modules/apps/infrastructure/retrieval/content-extract/storage";
import { search_documents } from "~/modules/functions/application/search_documents";
import { KnowledgeSyncRepository } from "~/modules/sources/infrastructure/KnowledgeSyncRepository";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { SourceSearchRepository } from "~/modules/sources/infrastructure/SourceSearchRepository";

import { prepareKnowledgeDatabase } from "../../../../../test/fixtures/sources/database";
import { addIndexedKnowledgeSource } from "../../../../../test/fixtures/sources/indexed-source";
import { knowledgeTestUser } from "../../../../../test/fixtures/sources/users";
import { databaseTestEnvironment } from "../../../../../test/helpers/environment";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let repository: SourceSearchRepository;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await prepareKnowledgeDatabase(database);
  repository = new SourceSearchRepository(databaseTestEnvironment(database));
});

afterAll(() => runtime.dispose());

function addSource(
  id: string,
  projectId: string | null = null,
  userId = 1,
  connectionId: string | null = null,
) {
  return addIndexedKnowledgeSource(database, repository, { id, projectId, userId, connectionId });
}

describe("native source knowledge", () => {
  it("transitions existing saved content into sources without a legacy search fallback", async () => {
    const source = await database
      .prepare("SELECT content, created_by_user_id FROM source WHERE id = 'knowledge_saved-note'")
      .first();

    expect(source).toEqual({ content: "First\n\nSecond", created_by_user_id: 1 });
    expect(
      await database
        .prepare("SELECT lifecycle_status FROM embedding_document WHERE id = 'saved-note'")
        .first("lifecycle_status"),
    ).toBe("delete_pending");
    expect((await repository.chunks("retired_saved-note")).map((chunk) => chunk.id).sort()).toEqual(
      ["old-vector-first", "old-vector-second"],
    );
    expect(
      await database
        .prepare("SELECT project_id, kind FROM source WHERE id = 'sandbox-run-historical-run'")
        .first(),
    ).toEqual({ project_id: "project-1", kind: "repository" });
    await repository.claim("retired_saved-note", "cleanup", "stale");
    await repository.removeStale("retired_saved-note", "cleanup");
    expect(
      await database.prepare("SELECT id FROM embedding_document WHERE id = 'saved-note'").first(),
    ).toBeNull();
    expect(await repository.chunks("retired_saved-note")).toEqual([]);
    expect(
      await database
        .prepare("SELECT content FROM source WHERE id = 'knowledge_saved-note'")
        .first("content"),
    ).toBe("First\n\nSecond");
  });

  it("finds exact identifiers while excluding foreign personal and project scopes", async () => {
    await addSource("personal");
    await addSource("foreign-personal", null, 2);
    await addSource("project", "project-1", 2);
    await addSource("foreign-project", "project-2");

    expect(
      (await repository.lexical({ userId: 1 }, toFtsQuery('INC-4821 " OR *') ?? "")).map(
        (chunk) => chunk.sourceId,
      ),
    ).toEqual(["personal"]);
    expect(
      (
        await repository.lexical(
          { userId: 1, projectId: "project-1" },
          toFtsQuery("INC-4821") ?? "",
        )
      ).map((chunk) => chunk.sourceId),
    ).toEqual(["project"]);
    const summaries = await new SourceRepository(
      databaseTestEnvironment(database),
    ).listPersonalSourceSummaries(1);

    expect(summaries.some((source) => source.id === "personal")).toBe(true);
    expect(summaries.every((source) => !("content" in source))).toBe(true);
    expect(
      summaries.some((source) => source.id === "foreign-personal" || source.id === "project"),
    ).toBe(false);
    expect(
      await repository.hydrate({ userId: 1 }, ["vector-foreign-personal", "vector-project"]),
    ).toEqual([]);
    await repository.invalidate("project");
    await database.prepare("DELETE FROM workspace_member WHERE user_id = 2").run();
    expect(
      (await repository.maintenance(false, false)).find((source) => source.id === "project")
        ?.user_id,
    ).toBe(1);
  });

  it("fences stale revisions before activation and hydration", async () => {
    await addSource("edited");
    await database
      .prepare("UPDATE source_search_document SET status = 'lexical' WHERE id = 'index-edited'")
      .run();
    await repository.claim("index-edited", "worker", "lexical");
    await database
      .prepare("UPDATE source SET content = 'New release decision' WHERE id = 'edited'")
      .run();

    expect((await repository.getSource("edited"))?.search_revision).toBe(2);
    expect(await repository.hydrate({ userId: 1 }, ["vector-edited"])).toEqual([]);
    await repository.invalidate("edited");
    expect((await repository.stale("edited")).map((document) => document.id)).toContain(
      "index-edited",
    );
    expect(await repository.activate("index-edited", "worker")).toBe(false);

    await addSource("restored");
    await database.prepare("UPDATE source SET status = 'archived' WHERE id = 'restored'").run();
    await database.prepare("UPDATE source SET status = 'available' WHERE id = 'restored'").run();
    expect((await repository.getSource("restored"))?.search_revision).toBe(3);
    expect(await repository.hydrate({ userId: 1 }, ["vector-restored"])).toEqual([]);
  });

  it("keeps personal keyword search working when semantic credentials are unavailable", async () => {
    const env = databaseTestEnvironment(database);
    const context = createServiceContext({ env, user: knowledgeTestUser });
    const response = await search_documents.execute(
      { query: "INC-4821" },
      {
        env,
        completionId: "test",
        request: { env, context, user: knowledgeTestUser, memoryScope: { type: "personal" } },
      },
    );

    expect(response.status).toBe("success");
    expect(response.content).toContain("personal");
    expect(response.content).not.toContain("foreign-personal");
    expect(response.content).not.toContain("foreign-project");
  });

  it("retains current keyword passages after a semantic index failure", async () => {
    await addSource("keyword-only");
    await database
      .prepare(
        "UPDATE source_search_document SET status = 'lexical' WHERE id = 'index-keyword-only'",
      )
      .run();
    expect(
      (await repository.lexical({ userId: 1 }, toFtsQuery("INC-4821") ?? "")).some(
        (chunk) => chunk.sourceId === "keyword-only",
      ),
    ).toBe(true);
  });

  it("exposes extraction failures so a source can be retried", async () => {
    await database
      .prepare(
        "INSERT INTO source (id, created_by_user_id, title, kind, status, mime_type) VALUES ('extract-failure', 1, 'Report', 'file', 'available', 'application/pdf')",
      )
      .run();
    await database
      .prepare(
        `INSERT INTO tasks (id, status, task_type, task_data) VALUES ('extract-failure-task', 'failed', 'source_knowledge_index', '{"sourceId":"extract-failure"}')`,
      )
      .run();
    expect(
      (await repository.listStatus({ userId: 1 })).find(
        (source) => source.sourceId === "extract-failure",
      )?.status,
    ).toBe("failed");
  });

  it("applies access changes independently of content and blocks revoked or deleted connections", async () => {
    await addSource("connected", null, 1, "connection");
    await database
      .prepare("UPDATE source SET metadata = '{\"permissionRevision\":2}' WHERE id = 'connected'")
      .run();
    expect((await repository.getSource("connected"))?.search_revision).toBe(1);
    await database
      .prepare("UPDATE provider_connection SET status = 'revoked' WHERE id = 'connection'")
      .run();
    expect(await repository.hydrate({ userId: 1 }, ["vector-connected"])).toEqual([]);
    await database.prepare("DELETE FROM provider_connection WHERE id = 'connection'").run();
    expect(await repository.hydrate({ userId: 1 }, ["vector-connected"])).toEqual([]);
    expect(
      await database.prepare("SELECT status FROM source WHERE id = 'connected'").first("status"),
    ).toBe("archived");
  });

  it("excludes deleted sources immediately and retains vector IDs until cleanup succeeds", async () => {
    await database.prepare("INSERT INTO user VALUES (4, 'four@example.com')").run();
    await addSource("deleted", null, 4);
    await database.prepare("DELETE FROM source WHERE id = 'deleted'").run();
    await database.prepare("DELETE FROM user WHERE id = 4").run();
    expect(await repository.hydrate({ userId: 1 }, ["vector-deleted"])).toEqual([]);
    expect((await repository.chunks("index-deleted")).map((chunk) => chunk.id)).toEqual([
      "vector-deleted",
    ]);
    expect((await repository.stale("deleted")).some((index) => index.id === "index-deleted")).toBe(
      true,
    );
    await repository.claim("index-deleted", "cleanup", "stale");
    await repository.removeStale("index-deleted", "cleanup");
    expect(await repository.chunks("index-deleted")).toEqual([]);
  });
});

describe("persistent source sync", () => {
  it("stores repository results once in their recorded scope and rejects cross-scope overwrites", async () => {
    const sources = new SourceRepository(databaseTestEnvironment(database));
    const input = {
      id: "sandbox-run-completed",
      userId: 1,
      projectId: "project-1",
      title: "Completed run",
      content: "First result",
      metadata: {},
    };

    await sources.upsertRepositorySource(input);
    await sources.upsertRepositorySource({ ...input, content: "Updated result" });
    expect((await sources.getSource(input.id))?.content).toBe("Updated result");
    await expect(sources.upsertRepositorySource({ ...input, userId: 2 })).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(
      sources.upsertRepositorySource({ ...input, projectId: undefined }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await sources.getSource(input.id))?.project_id).toBe("project-1");
  });
  it("limits partial-write rollback to the creating user and scope", async () => {
    await addSource("rollback-personal");
    await addSource("rollback-foreign", null, 2);
    await addSource("rollback-project", "project-1");
    const sources = new SourceRepository(databaseTestEnvironment(database));

    await sources.removeCreatedSources(1, null, [
      "rollback-personal",
      "rollback-foreign",
      "rollback-project",
    ]);
    expect(await sources.getSource("rollback-personal")).toBeNull();
    expect(await sources.getSource("rollback-foreign")).not.toBeNull();
    expect(await sources.getSource("rollback-project")).not.toBeNull();
  });

  it("rolls back a partially saved extraction and hides database failure details", async () => {
    await database
      .prepare(`CREATE TRIGGER reject_extraction BEFORE INSERT ON source
      WHEN new.content = 'private-provider-detail' BEGIN SELECT RAISE(ABORT, 'private-provider-detail'); END;`)
      .run();
    const env = databaseTestEnvironment(database);
    const context = createServiceContext({ env, user: knowledgeTestUser });
    const extracted = {
      results: [
        { url: "https://rollback.test/one", raw_content: "First extracted page" },
        { url: "https://rollback.test/two", raw_content: "private-provider-detail" },
      ],
      failed_results: [],
      response_time: 1,
    };
    const result: ContentExtractResult = { status: "success", data: { extracted } };

    try {
      await maybeStoreExtractedKnowledge({
        params: { urls: extracted.results.map((entry) => entry.url), storeKnowledge: true },
        req: { env, context, user: knowledgeTestUser, memoryScope: { type: "personal" } },
        provider: "cloudflare",
        extracted,
        result,
      });
      expect(
        await database
          .prepare("SELECT id FROM source WHERE external_uri IN (?, ?)")
          .bind(...extracted.results.map((entry) => entry.url))
          .all(),
      ).toMatchObject({ results: [] });
      expect(result.data.storedKnowledge).toEqual({
        success: false,
        error: "Unable to store extracted content",
      });
      expect(JSON.stringify(result.data.storedKnowledge)).not.toContain("private-provider-detail");
    } finally {
      await database.prepare("DROP TRIGGER reject_extraction").run();
    }
  });
  it("excludes shared knowledge after pause, publisher demotion or connection revocation and fences stale sync writes", async () => {
    await database
      .prepare(
        "INSERT INTO provider_connection (id, status) VALUES ('sync-connection', 'connected')",
      )
      .run();
    const syncs = new KnowledgeSyncRepository(databaseTestEnvironment(database));
    const sources = new SourceRepository(databaseTestEnvironment(database));

    await database
      .prepare(`INSERT INTO source_knowledge_sync
      (id, user_id, project_id, connection_id, recipe_id, integration_id, title, resources)
      VALUES ('sync', 1, 'project-1', 'sync-connection', 'knowledge', 'records', 'Shared knowledge', '[]')`)
      .run();
    const sync = await syncs.get("sync");

    if (!sync) {
      throw new Error("Sync fixture missing");
    }

    await syncs.claim(sync.id, sync.generation, "current");
    const resource: Parameters<KnowledgeSyncRepository["commitResource"]>[2] = {
      sourceId: "shared-document",
      resourceId: "doc",
      resourceCount: 1,
      provider: "notion",
      title: "Release plan",
      content: "INC-4821 shared decision",
      status: "available",
      externalUri: null,
      upstreamRevision: "1",
    };

    expect(await syncs.commitResource(sync, "current", resource)).toBe(true);
    expect(await sources.getSource(resource.sourceId)).not.toBeNull();
    await syncs.control(sync.id, "pause");
    expect(await sources.getSource(resource.sourceId)).toBeNull();
    expect(
      await syncs.commitResource(sync, "current", { ...resource, content: "stale write" }),
    ).toBe(false);
    await syncs.control(sync.id, "resume");
    const resumed = await syncs.get(sync.id);

    if (!resumed) {
      throw new Error("Resumed sync missing");
    }

    await syncs.claim(sync.id, resumed.generation, "resumed");
    expect((await sources.getSource(resource.sourceId))?.content).toBe(resource.content);
    await database
      .prepare(
        "UPDATE workspace_member SET role = 'member' WHERE user_id = 1 AND workspace_id = 'workspace-1'",
      )
      .run();
    expect(await sources.getSource(resource.sourceId)).toBeNull();
    expect(
      await syncs.commitResource(resumed, "resumed", {
        ...resource,
        content: "unauthorised write",
      }),
    ).toBe(false);
    expect((await syncs.get(sync.id))?.generation).toBe(resumed.generation);
    await database
      .prepare(
        "UPDATE workspace_member SET role = 'owner' WHERE user_id = 1 AND workspace_id = 'workspace-1'",
      )
      .run();
    await database
      .prepare("UPDATE project_capability SET excluded = 1 WHERE project_id = 'project-1'")
      .run();
    expect(await sources.getSource(resource.sourceId)).toBeNull();
    await database
      .prepare("UPDATE project_capability SET excluded = 0 WHERE project_id = 'project-1'")
      .run();
    await database
      .prepare("UPDATE provider_connection SET status = 'revoked' WHERE id = 'sync-connection'")
      .run();
    expect(await sources.getSource(resource.sourceId)).toBeNull();
    await database.prepare("DELETE FROM provider_connection WHERE id = 'sync-connection'").run();
    expect(await sources.getSource(resource.sourceId)).toBeNull();
    expect((await repository.getSource(resource.sourceId))?.status).toBe("archived");
  });
});
