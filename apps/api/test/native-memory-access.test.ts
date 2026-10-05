import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { readRunMemoryDocument } from "~/modules/memory-documents/application/pages";
import type { MemoryScope } from "~/types";

import { databaseTestEnvironment } from "./environment";
import { memoryDocumentFixture, nativeMemoryUser } from "./native-memory";

const guards = vi.hoisted(() => ({ project: vi.fn(), teammate: vi.fn() }));

vi.mock("~/modules/workspaces/application/access", () => ({
  requireProjectAccess: guards.project,
}));
vi.mock("~/modules/teammates/application/contexts", () => ({
  requireTeammateContext: guards.teammate,
}));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let context: ServiceContext;
const scope: MemoryScope = {
  type: "bound",
  scopeType: "project",
  scopeId: "project",
  documents: [{ documentId: "memory", access: "read" }],
  teammateContext: { id: "context", memoryDocumentId: "memory" },
};

beforeAll(async () => {
  context = createServiceContext({
    env: databaseTestEnvironment(await runtime.getD1Database("DB")),
    user: nativeMemoryUser,
  });
});
beforeEach(() => {
  vi.restoreAllMocks();
  guards.project.mockReset().mockResolvedValue({ project: { id: "project" } });
  guards.teammate.mockReset().mockResolvedValue({
    id: "context",
    actorUserId: 1,
    memoryDocumentId: "memory",
    scope: { type: "project", id: "project" },
    status: "active",
  });
  vi.spyOn(context.repositories.memoryDocuments, "getDocumentById").mockResolvedValue(
    memoryDocumentFixture(),
  );
});
afterAll(async () => {
  await runtime.dispose();
});

describe("run-bound memory reads", () => {
  it("permits read-only grants and rejects IDs absent from this run", async () => {
    expect(
      await readRunMemoryDocument(context, scope, {
        documentId: "memory",
        revision: 1,
        offset: 0,
        maxCharacters: 10,
      }),
    ).toMatchObject({ content: "Prefer con", nextOffset: 10 });
    await expect(
      readRunMemoryDocument(context, scope, {
        documentId: "foreign",
        revision: 1,
        offset: 0,
        maxCharacters: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("rechecks project access on every page and refuses combining stale revisions", async () => {
    await readRunMemoryDocument(context, scope, {
      documentId: "memory",
      revision: 1,
      offset: 0,
      maxCharacters: 10,
    });
    guards.project.mockRejectedValueOnce(new Error("Membership revoked"));
    await expect(
      readRunMemoryDocument(context, scope, {
        documentId: "memory",
        revision: 1,
        offset: 10,
        maxCharacters: 10,
      }),
    ).rejects.toThrow("Membership revoked");
    vi.spyOn(context.repositories.memoryDocuments, "getDocumentById").mockResolvedValue(
      memoryDocumentFixture({ revision: 2 }),
    );
    await expect(
      readRunMemoryDocument(context, scope, {
        documentId: "memory",
        revision: 1,
        offset: 10,
        maxCharacters: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("rejects another user's personal document and changed teammate grants", async () => {
    vi.spyOn(context.repositories.memoryDocuments, "getDocumentById").mockResolvedValue(
      memoryDocumentFixture({ scope_id: "2" }),
    );
    await expect(
      readRunMemoryDocument(context, scope, {
        documentId: "memory",
        revision: 1,
        offset: 0,
        maxCharacters: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    guards.teammate.mockResolvedValueOnce({
      memoryDocumentId: "another",
      scope: { type: "project", id: "project" },
    });
    await expect(
      readRunMemoryDocument(context, scope, {
        documentId: "memory",
        revision: 1,
        offset: 0,
        maxCharacters: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const personal: MemoryScope = {
      type: "bound",
      scopeType: "personal",
      scopeId: "2",
      documents: [{ documentId: "memory", access: "read" }],
    };

    await expect(
      readRunMemoryDocument(context, personal, {
        documentId: "memory",
        revision: 1,
        offset: 0,
        maxCharacters: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
