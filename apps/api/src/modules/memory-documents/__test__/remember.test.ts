import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";

import { rememberInScope } from "../application/remember";

const generateTierObject = vi.hoisted(() => vi.fn());

vi.mock("~/modules/models/application/tier-object", () => ({ generateTierObject }));

const SCOPE = { scopeType: "personal" as const, scopeId: "7" };
const DRAFT = {
  description: "Writes in British English and wants replies to match",
  type: "feedback",
  content:
    "Prefers British English.\n\n**Why:** said so when correcting a reply.\n\n**How to apply:** use British spelling everywhere.",
  changeNote: "Added spelling preference",
};

function row(overrides: Partial<MemoryDocumentRow>): MemoryDocumentRow {
  return {
    id: "document-1",
    scope_type: "personal",
    scope_id: "7",
    kind: "memory",
    name: "writing-style",
    content: "Likes short replies.",
    metadata: JSON.stringify({ description: "How replies should read", type: "feedback" }),
    revision: 2,
    created_by: 7,
    deleted_at: null,
    created_at: "2026-10-25",
    updated_at: "2026-10-25",
    ...overrides,
  };
}

function setup(documents: MemoryDocumentRow[], placed: string) {
  generateTierObject.mockImplementation(async (_context: unknown, { name }: { name: string }) =>
    name === "memory_placement" ? { name: placed } : DRAFT,
  );
  const repository = {
    listDocuments: vi.fn(async () => documents),
    getDocumentByName: vi.fn(
      async (_scope: unknown, name: string) => documents.find((doc) => doc.name === name) ?? null,
    ),
    appendRevision: vi.fn(async () => row({ revision: 3 })),
    createDocument: vi.fn(async () => row({ id: "document-2", name: placed })),
  };
  const context = {
    requireUser: () => ({ id: 7 }),
    repositories: fakeRepositories([[MemoryDocumentRepository, repository]]),
  } as unknown as ServiceContext;

  return { context, repository };
}

describe("rememberInScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rewrites the document the memory belongs to as a whole", async () => {
    const { context, repository } = setup([row({})], "writing-style");

    await rememberInScope(context, SCOPE, 7, { text: "Prefers British English" });

    const write = generateTierObject.mock.calls.find(
      ([, request]) => request.name === "memory_document",
    );

    expect(write?.[1].material).toContain("Likes short replies.");
    expect(repository.appendRevision).toHaveBeenCalledWith({
      documentId: "document-1",
      content: DRAFT.content,
      details: { description: DRAFT.description, type: "feedback" },
      changeNote: DRAFT.changeNote,
      createdByUserId: 7,
      expectedRevision: 2,
      operationId: undefined,
    });
    expect(repository.createDocument).not.toHaveBeenCalled();
  });

  it("starts a new document when no existing one covers the memory", async () => {
    const { context, repository } = setup([row({})], "home-address");

    await rememberInScope(context, SCOPE, 7, { text: "Lives in Bristol", operationId: "op-1" });

    expect(repository.createDocument).toHaveBeenCalledWith({
      ...SCOPE,
      name: "home-address",
      content: DRAFT.content,
      details: { description: DRAFT.description, type: "feedback" },
      createdByUserId: 7,
      operationId: "op-1",
    });
    expect(repository.appendRevision).not.toHaveBeenCalled();
  });

  it("redrafts from the latest revision when the document changed meanwhile", async () => {
    const { context, repository } = setup([row({})], "writing-style");

    repository.appendRevision.mockResolvedValueOnce(null);
    repository.getDocumentByName
      .mockResolvedValueOnce(row({}))
      .mockResolvedValueOnce(
        row({ revision: 5, content: "Likes short replies. Uses Oxford commas." }),
      );

    await rememberInScope(context, SCOPE, 7, { text: "Prefers British English" });

    expect(repository.appendRevision).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedRevision: 5 }),
    );
    expect(generateTierObject.mock.calls.at(-1)?.[1].material).toContain("Uses Oxford commas.");
  });
});
