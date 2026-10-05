import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import {
  MemoryReflectionRepository,
  type CommitMemoryReflection,
} from "~/modules/memory-documents/infrastructure/MemoryReflectionRepository";

import { databaseTestEnvironment } from "./environment";
import { initialiseNativeMemoryDatabase } from "./native-memory-database";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let documents: MemoryDocumentRepository;
let reflections: MemoryReflectionRepository;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseNativeMemoryDatabase(database);
  const env = databaseTestEnvironment(database);

  documents = new MemoryDocumentRepository(env);
  reflections = new MemoryReflectionRepository(env);
});
beforeEach(async () => {
  await database.batch([
    database.prepare("DELETE FROM memory_reflection_result"),
    database.prepare("DELETE FROM memory_reflection_checkpoint"),
    database.prepare("DELETE FROM memory_document_revision WHERE revision > 1"),
    database.prepare(
      "UPDATE memory_document SET revision = 1, content = 'Deploy to Netlify. Keep concise answers.', tier = 'core', summary = ''",
    ),
    database.prepare("UPDATE teammate_context SET status = 'active'"),
    database.prepare(
      "UPDATE tasks SET status = 'running', execution_owner_token = 'owner', execution_lease_expires_at = '2099-01-01T00:00:00.000Z'",
    ),
  ]);
});
afterAll(async () => {
  await runtime.dispose();
});

async function proposal(
  overrides: Partial<CommitMemoryReflection> = {},
): Promise<CommitMemoryReflection> {
  const base = await documents.getDocumentById("memory");

  if (!base) {
    throw new Error("Missing fixture memory");
  }

  return {
    operationId: "task",
    taskId: "task",
    ownerToken: "owner",
    contextId: "context",
    conversationId: "conversation",
    afterMessageId: null,
    throughMessageId: "correction",
    base,
    content: "Deploy to Cloudflare. Keep concise answers.",
    changeNote: "Corrected deployment target",
    evidenceJson: '[{"messageId":"correction","quote":"Use Cloudflare"}]',
    userId: 1,
    ...overrides,
  };
}

describe("atomic native memory maintenance", () => {
  it("transitions stored context snapshots to the new contract without losing document references", async () => {
    const row = await database
      .prepare("SELECT context_json FROM conversation_run WHERE id = 'legacy-run'")
      .first<{ context_json: string }>();

    expect(JSON.parse(row?.context_json ?? "{}")).toMatchObject({
      protocolVersion: 2,
      documents: [{ id: "memory", status: "included", contentTokens: null }],
    });
  });
  it("preserves sources on a concurrent edit and commits only after recomputation", async () => {
    const input = await proposal();

    await documents.appendRevision({
      documentId: "memory",
      content: "Keep concise answers. Use Cloudflare.",
      expectedRevision: 1,
      createdByUserId: 1,
      tier: "reference",
      summary: "Deployments",
    });
    expect(await reflections.commit(input)).toBeNull();
    expect(await reflections.checkpoint("context", "conversation")).toBeNull();
    expect(await reflections.outcome("task")).toBeNull();
    const fresh = await proposal();

    expect(await reflections.commit({ ...fresh, content: fresh.base.content })).toMatchObject({
      status: "no_change",
      revision: 2,
    });
    expect(await documents.listRevisions("memory")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tier: "reference", summary: "Deployments" }),
      ]),
    );
  });
  it("refuses a stale source checkpoint without overwriting newer memory", async () => {
    await reflections.commit(await proposal());
    const fresh = await proposal({
      operationId: "other",
      throughMessageId: "later",
      afterMessageId: null,
    });

    expect(await reflections.commit(fresh)).toBeNull();
    expect(await reflections.checkpoint("context", "conversation")).toBe("correction");
  });
  it.each(["owner", "lease", "context"])(
    "refuses a revoked %s before committing or consuming sources",
    async (boundary) => {
      const input = await proposal();

      await database
        .prepare(
          boundary === "owner"
            ? "UPDATE tasks SET execution_owner_token = 'other'"
            : boundary === "lease"
              ? "UPDATE tasks SET execution_lease_expires_at = '2000-01-01'"
              : "UPDATE teammate_context SET status = 'paused'",
        )
        .run();
      expect(await reflections.commit(input)).toBeNull();
      expect(await reflections.checkpoint("context", "conversation")).toBeNull();
      expect(await documents.getDocumentById("memory")).toMatchObject({ revision: 1 });
    },
  );
});
