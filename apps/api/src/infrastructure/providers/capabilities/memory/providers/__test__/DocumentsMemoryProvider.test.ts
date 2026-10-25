import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";

import { DocumentsMemoryProvider } from "../DocumentsMemoryProvider";

const rememberInScope = vi.hoisted(() => vi.fn(async () => ({ id: "document-1" })));

vi.mock("~/modules/workspaces/application/access", () => ({ requireProjectAccess: vi.fn() }));
vi.mock("~/modules/memory-documents/application/remember", () => ({
  rememberInScope,
  rememberInDocument: vi.fn(),
}));

function createContext() {
  const memoryDocuments = {
    softDeleteDocument: vi.fn(async () => undefined),
    searchDocuments: vi.fn(async () => [
      {
        id: "document-1",
        name: "british-english",
        content: "Prefers British English",
        metadata: null,
        revision: 3,
      },
    ]),
  };

  return {
    context: {
      requireUser: () => ({ id: 7 }),
      repositories: fakeRepositories([[MemoryDocumentRepository, memoryDocuments]]),
    } as unknown as ServiceContext,
    memoryDocuments,
  };
}

function createProvider(scope?: { type: "project"; projectId: string }) {
  const { context, memoryDocuments } = createContext();
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

  it("files a memory through the document writer in the personal scope", async () => {
    const { provider } = createProvider();

    const result = await provider.storeMemory({
      text: "Prefers British English",
      metadata: { category: "preference" },
      conversationId: "conversation-1",
      operationId: "operation-1",
    });

    expect(result).toEqual({ id: "document-1", provider: "documents" });
    expect(rememberInScope).toHaveBeenCalledWith(
      expect.anything(),
      { scopeType: "personal", scopeId: "7" },
      7,
      {
        text: "Prefers British English",
        category: "preference",
        conversationId: "conversation-1",
        operationId: "operation-1",
      },
    );
  });

  it("keeps project memories in the project's scope", async () => {
    const { provider } = createProvider({ type: "project", projectId: "project-1" });

    await provider.storeMemory({ text: "Ship on Thursdays", metadata: {} });

    expect(rememberInScope).toHaveBeenCalledWith(
      expect.anything(),
      { scopeType: "project", scopeId: "project-1" },
      7,
      expect.objectContaining({ text: "Ship on Thursdays" }),
    );
  });

  it("returns what it found in words rather than as a score", async () => {
    const { provider } = createProvider();

    const results = await provider.retrieveMemories("british");

    expect(results).toHaveLength(1);
    expect(results[0]?.text).toContain("Prefers British English");
    expect(results[0]?.metadata).toMatchObject({
      documentId: "document-1",
      revision: 3,
      offset: 0,
      nextOffset: null,
    });
  });

  it("returns nothing for an empty query rather than everything", async () => {
    const { provider, memoryDocuments } = createProvider();

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
