import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import { DocumentsMemoryProvider, MEMORY_JOURNAL_DOCUMENT } from "../DocumentsMemoryProvider";

function createContext(existing: { id: string; content: string; revision: number } | null) {
  const memoryDocuments = {
    getDocumentByName: vi.fn(async () => existing),
    createDocument: vi.fn(async () => ({ id: "document-1" })),
    appendRevision: vi.fn(async () => ({ id: existing?.id ?? "document-1" })),
    softDeleteDocument: vi.fn(async () => undefined),
    searchDocuments: vi.fn(async () => [
      {
        id: "document-1",
        name: MEMORY_JOURNAL_DOCUMENT,
        content: "- Prefers British English",
        revision: 3,
      },
    ]),
  };

  return {
    context: { repositories: { memoryDocuments } } as unknown as ServiceContext,
    memoryDocuments,
  };
}

function createProvider(
  existing: { id: string; content: string; revision: number } | null,
  scope?: { type: "project"; projectId: string },
) {
  const { context, memoryDocuments } = createContext(existing);
  const provider = new DocumentsMemoryProvider({
    env: {} as never,
    user: { id: 7 } as never,
    serviceContext: context,
    ...(scope ? { memoryScope: scope } : {}),
  });

  return { provider, memoryDocuments };
}

describe("DocumentsMemoryProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a journal document the first time it remembers something", async () => {
    const { provider, memoryDocuments } = createProvider(null);

    const result = await provider.storeMemory({
      text: "Prefers British English",
      metadata: {},
      conversationId: "conversation-1",
    });

    expect(result.provider).toBe("documents");
    expect(memoryDocuments.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeType: "personal",
        scopeId: "7",
        name: MEMORY_JOURNAL_DOCUMENT,
        content: "- Prefers British English (from conversation conversation-1)",
      }),
    );
  });

  it("appends a revision rather than replacing what is already there", async () => {
    const { provider, memoryDocuments } = createProvider({
      id: "document-1",
      content: "- Already known",
      revision: 4,
    });

    await provider.storeMemory({ text: "Also this", metadata: {} });

    expect(memoryDocuments.appendRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "document-1",
        expectedRevision: 4,
        content: "- Already known\n- Also this",
      }),
    );
  });

  it("keeps project memories in the project's scope", async () => {
    const { provider, memoryDocuments } = createProvider(null, {
      type: "project",
      projectId: "project-1",
    });

    await provider.storeMemory({ text: "Ship on Thursdays", metadata: {} });

    expect(memoryDocuments.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ scopeType: "project", scopeId: "project-1" }),
    );
  });

  it("returns what it found in words rather than as a score", async () => {
    const { provider } = createProvider(null);

    const results = await provider.retrieveMemories("british");

    expect(results).toHaveLength(1);
    expect(results[0]?.text).toContain("Prefers British English");
    expect(results[0]?.metadata?.excerpt).toBe("- Prefers British English");
  });

  it("returns nothing for an empty query rather than everything", async () => {
    const { provider, memoryDocuments } = createProvider(null);

    await expect(provider.retrieveMemories("   ")).resolves.toEqual([]);
    expect(memoryDocuments.searchDocuments).not.toHaveBeenCalled();
  });

  it("refuses without a signed-in user", async () => {
    const provider = new DocumentsMemoryProvider({ env: {} as never });

    await expect(provider.storeMemory({ text: "anything", metadata: {} })).rejects.toBeInstanceOf(
      AssistantError,
    );
  });
});
