import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { createMemoryDocument, listMemoryDocuments, updateMemoryDocument } from "../index";

const requireProjectAccess = vi.hoisted(() =>
  vi.fn(async () => ({ project: { id: "project-1" } })),
);

vi.mock("~/services/workspaces/access", () => ({ requireProjectAccess }));

function createContext(
  existing: { id: string; revision: number } | null,
  appendResult: unknown = { id: "document-1", name: "brief", content: "new", revision: 5 },
) {
  const memoryDocuments = {
    listDocuments: vi.fn(async () => [
      {
        id: "document-1",
        name: "brief",
        content: "  a long   memory  ",
        revision: 2,
        scope_type: "personal",
        scope_id: "7",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      },
    ]),
    getDocumentByName: vi.fn(async () => existing),
    createDocument: vi.fn(async () => ({
      id: "document-1",
      name: "brief",
      content: "",
      revision: 1,
      scope_type: "personal",
      scope_id: "7",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    })),
    appendRevision: vi.fn(async () => appendResult),
  };

  return {
    ensureDatabase: vi.fn(),
    requireUser: () => ({ id: 7 }),
    repositories: { memoryDocuments },
  } as unknown as ServiceContext;
}

describe("memory documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summarises a document without sending its whole body", async () => {
    const context = createContext(null);

    const { documents } = await listMemoryDocuments(context);

    expect(documents[0]).toMatchObject({ name: "brief", excerpt: "a long memory" });
    expect(documents[0]).not.toHaveProperty("content");
  });

  it("refuses a second document with a name already used in that scope", async () => {
    const context = createContext({ id: "document-1", revision: 1 });

    await expect(
      createMemoryDocument(context, { name: "brief", content: "" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses a save that was written against an older revision", async () => {
    const context = createContext({ id: "document-1", revision: 5 }, null);

    await expect(
      updateMemoryDocument(context, "brief", { content: "mine", expectedRevision: 4 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("checks project membership before touching a project's memory", async () => {
    const context = createContext(null);

    await listMemoryDocuments(context, "project-1");

    expect(requireProjectAccess).toHaveBeenCalledWith(context, "project-1");
    expect(context.repositories.memoryDocuments.listDocuments).toHaveBeenCalledWith({
      scopeType: "project",
      scopeId: "project-1",
    });
  });
});
