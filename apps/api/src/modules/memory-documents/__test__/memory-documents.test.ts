import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";

import { listMemoryDocuments } from "../application/memory-documents";

const requireProjectAccess = vi.hoisted(() =>
  vi.fn(async () => ({ project: { id: "project-1" } })),
);

vi.mock("~/modules/workspaces/application/access", () => ({ requireProjectAccess }));

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
    repositories: fakeRepositories([[MemoryDocumentRepository, memoryDocuments]]),
  } as unknown as ServiceContext;
}

describe("memory documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks project membership before touching a project's memory", async () => {
    const context = createContext(null);

    await listMemoryDocuments(context, "project-1");

    expect(requireProjectAccess).toHaveBeenCalledWith(context, "project-1");
    expect(context.repositories.get(MemoryDocumentRepository).listDocuments).toHaveBeenCalledWith({
      scopeType: "project",
      scopeId: "project-1",
    });
  });
});
