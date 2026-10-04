import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { search_documents } from "~/modules/functions/application/search_documents";
import { SourceIndexRepository } from "~/modules/sources/infrastructure/SourceIndexRepository";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { SourceSyncRepository } from "~/modules/sources/infrastructure/SourceSyncRepository";

import { databaseTestEnvironment } from "../../../../../test/environment";
import { prepareKnowledgeDatabase } from "../../../../../test/fixtures/sources/database";
import { addIndexedKnowledgeSource } from "../../../../../test/fixtures/sources/indexed-source";
import { knowledgeTestUser } from "../../../../../test/fixtures/sources/users";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let repository: SourceIndexRepository;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await prepareKnowledgeDatabase(database);
  repository = new SourceIndexRepository(databaseTestEnvironment(database));
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
    expect((await repository.getVectorIds("retired_saved-note")).sort()).toEqual([
      "old-vector-first",
      "old-vector-second",
    ]);
    expect(
      await database
        .prepare("SELECT project_id, kind FROM source WHERE id = 'sandbox-run-historical-run'")
        .first(),
    ).toEqual({ project_id: "project-1", kind: "repository" });
    await repository.remove("retired_saved-note");
    expect(
      await database.prepare("SELECT id FROM embedding_document WHERE id = 'saved-note'").first(),
    ).toBeNull();
    expect(await repository.getVectorIds("retired_saved-note")).toEqual([]);
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
      (await repository.searchKeywords({ userId: 1 }, 'INC-4821 " OR *')).map(
        (chunk) => chunk.source_id,
      ),
    ).toEqual(["personal"]);
    expect(
      (await repository.searchKeywords({ userId: 1, projectId: "project-1" }, "INC-4821")).map(
        (chunk) => chunk.source_id,
      ),
    ).toEqual(["project"]);
    expect(
      await repository.hydrate({ userId: 1 }, ["vector-foreign-personal", "vector-project"]),
    ).toEqual([]);
  });

  it("fences stale revisions before activation and hydration", async () => {
    await addSource("edited");
    await database
      .prepare("UPDATE source SET content = 'New release decision' WHERE id = 'edited'")
      .run();

    expect(await repository.getSourceRevision("edited")).toBe(2);
    expect(await repository.hydrate({ userId: 1 }, ["vector-edited"])).toEqual([]);
    await repository.prepare({
      id: "stale-index",
      sourceId: "edited",
      revision: 3,
      userId: 1,
      target: "{}",
      title: "stale",
      chunks: [{ id: "stale-chunk", vectorId: "stale-vector", index: 0, content: "stale" }],
    });
    expect(await repository.activate("stale-index")).toBe(false);

    await addSource("restored");
    await database.prepare("UPDATE source SET status = 'archived' WHERE id = 'restored'").run();
    await database.prepare("UPDATE source SET status = 'available' WHERE id = 'restored'").run();
    expect(await repository.getSourceRevision("restored")).toBe(2);
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
        "UPDATE source_index SET lifecycle_status = 'failed' WHERE id = 'index-keyword-only'",
      )
      .run();
    expect(
      (await repository.searchKeywords({ userId: 1 }, "INC-4821")).some(
        (chunk) => chunk.source_id === "keyword-only",
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
      .prepare("INSERT INTO tasks VALUES ('source_index_extract-failure_1', 'failed')")
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
    expect(await repository.getSourceRevision("connected")).toBe(1);
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
    expect(await repository.getVectorIds("index-deleted")).toEqual(["vector-deleted"]);
    expect((await repository.listObsolete()).some((index) => index.id === "index-deleted")).toBe(
      true,
    );
    await repository.remove("index-deleted");
    expect(await repository.getVectorIds("index-deleted")).toEqual([]);
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
  it("refreshes source access independently and denies new project audiences immediately", async () => {
    await database
      .prepare(
        "INSERT INTO provider_connection (id, status) VALUES ('sync-connection', 'connected')",
      )
      .run();
    const syncs = new SourceSyncRepository(databaseTestEnvironment(database));
    const sources = new SourceRepository(databaseTestEnvironment(database));
    const sync = await syncs.create(
      1,
      {
        provider: "googledrive",
        projectId: "project-1",
        accountId: "external",
        rootId: "folder",
        title: "Shared knowledge",
      },
      "sync-connection",
    );

    expect(
      await syncs.begin(sync.id, "scan", { folders: ["folder"], folderIndex: 0, pageToken: null }),
    ).toBe(true);
    const input = {
      sync,
      runId: "scan",
      page: 0,
      upstreamId: "upstream",
      version: "1",
      title: "Release plan",
      content: "Release plan INC-4821",
      sourceUrl: "https://drive.google.com/file/d/upstream/view",
    };

    await syncs.storeDocument({
      ...input,
      permissions: {
        public: false,
        emails: ["one@example.com", "two@example.com"],
        validUntil: null,
      },
    });
    const source = await syncs.getSyncedSource(sync.id, "upstream");

    expect(source).not.toBeNull();
    if (!source) {
      throw new Error("Expected synced source");
    }

    expect(await sources.getSource(source.id)).not.toBeNull();
    const revision = await repository.getSourceRevision(source.id);

    await syncs.storeDocument({
      ...input,
      permissions: { public: false, emails: ["one@example.com"], validUntil: null },
    });
    expect(await repository.getSourceRevision(source.id)).toBe(revision);
    expect(await sources.getSource(source.id)).toBeNull();

    await syncs.storeDocument({
      ...input,
      permissions: {
        public: false,
        emails: ["one@example.com", "two@example.com"],
        validUntil: null,
      },
    });
    await database.prepare("INSERT INTO user VALUES (3, 'three@example.com')").run();
    await database
      .prepare("INSERT INTO workspace_member VALUES ('workspace-1', 3, 'member')")
      .run();
    expect(await sources.getSource(source.id)).toBeNull();
    await database.prepare("DELETE FROM workspace_member WHERE user_id = 3").run();
    expect(await sources.getSource(source.id)).not.toBeNull();

    await syncs.setEnabled(sync.id, false);
    expect(await sources.getSource(source.id)).toBeNull();
    await syncs.storeDocument({
      ...input,
      permissions: { public: true, emails: [], validUntil: null },
      content: "Stale writer",
    });
    expect((await syncs.getSyncedSource(sync.id, "upstream"))?.content).toBe(input.content);

    await syncs.setEnabled(sync.id, true);
    await syncs.begin(sync.id, "resumed", { folders: ["folder"], folderIndex: 0, pageToken: null });
    await syncs.storeDocument({
      ...input,
      runId: "resumed",
      permissions: { public: true, emails: [], validUntil: null },
    });
    await syncs.invalidatePermissions(sync.id, "upstream", "scan", 0);
    await syncs.archiveDocument(sync.id, "upstream", "scan", 0);
    await syncs.fail(sync.id, "scan", 0, "Stale failure");
    expect(await sources.getSource(source.id)).not.toBeNull();
    expect((await syncs.get(sync.id))?.status).toBe("syncing");
    await syncs.storeDocument({
      ...input,
      runId: "resumed",
      permissions: { public: true, emails: [], validUntil: "2000-01-01T00:00:00Z" },
    });
    expect(await sources.getSource(source.id)).toBeNull();
    await syncs.remove(sync.id);
    expect(await syncs.getSyncedSource(sync.id, "upstream")).toBeNull();
  });

  it("prunes only after a complete current scan and never accepts an obsolete checkpoint", async () => {
    const syncs = new SourceSyncRepository(databaseTestEnvironment(database));
    const sync = await syncs.create(
      1,
      {
        provider: "googledrive",
        accountId: "external",
        rootId: "another-folder",
        title: "Personal knowledge",
      },
      "sync-connection",
    );

    await syncs.begin(sync.id, "first", {
      folders: ["another-folder"],
      folderIndex: 0,
      pageToken: null,
    });
    const document = {
      sync,
      page: 0,
      upstreamId: "document",
      version: "1",
      title: "A note",
      content: "Keep this note",
      sourceUrl: "https://drive.google.com/file/d/document/view",
      permissions: { public: false, emails: [], validUntil: null },
    };

    await syncs.storeDocument({ ...document, runId: "first" });
    await syncs.complete(sync.id, "first", 0);
    await syncs.begin(sync.id, "second", {
      folders: ["another-folder"],
      folderIndex: 0,
      pageToken: null,
    });
    await syncs.fail(sync.id, "second", 0, "Temporary failure");
    expect((await syncs.getSyncedSource(sync.id, "document"))?.status).toBe("available");
    await syncs.complete(sync.id, "first", 0);
    expect((await syncs.getSyncedSource(sync.id, "document"))?.status).toBe("available");
    expect(
      await syncs.checkpoint(sync.id, "first", 0, {
        folders: ["another-folder"],
        folderIndex: 0,
        pageToken: null,
      }),
    ).toBe(false);
    await syncs.complete(sync.id, "second", 0);
    expect((await syncs.getSyncedSource(sync.id, "document"))?.status).toBe("archived");
  });
});
