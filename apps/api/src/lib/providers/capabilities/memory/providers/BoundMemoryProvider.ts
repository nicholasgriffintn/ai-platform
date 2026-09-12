import type {
  MemoryProvider,
  MemoryProviderCapabilities,
  MemoryRetrieveOptions,
  MemoryRetrieveResult,
  MemoryStoreInput,
} from "../types";

export class BoundMemoryProvider implements MemoryProvider {
  readonly name = "documents" as const;
  readonly capabilities: MemoryProviderCapabilities;

  constructor(
    private readonly documents: MemoryProvider,
    private readonly baseline?: MemoryProvider,
    private readonly boundDocumentIds: ReadonlySet<string> = new Set(),
  ) {
    this.capabilities = {
      ...documents.capabilities,
      reasoning: documents.capabilities.reasoning || Boolean(baseline?.capabilities.reasoning),
      conversationIngestion:
        documents.capabilities.conversationIngestion ||
        Boolean(baseline?.capabilities.conversationIngestion),
      externalStorage:
        documents.capabilities.externalStorage || Boolean(baseline?.capabilities.externalStorage),
    };
  }

  storeMemory(input: MemoryStoreInput) {
    if (input.documentId || !this.baseline) {
      return this.documents.storeMemory(input);
    }

    return this.baseline.storeMemory(input);
  }

  async retrieveMemories(
    query: string,
    options?: MemoryRetrieveOptions,
  ): Promise<MemoryRetrieveResult[]> {
    const resultSets = await Promise.all([
      this.documents.retrieveMemories(query, options),
      this.baseline?.retrieveMemories(query, options) ?? [],
    ]);
    const limit = options?.topK ?? 5;
    const unique = new Map<string, MemoryRetrieveResult>();

    for (const result of resultSets.flat()) {
      const key = result.id ?? `${result.text}\u0000${result.score}`;
      const existing = unique.get(key);

      if (!existing || result.score > existing.score) {
        unique.set(key, result);
      }
    }

    return [...unique.values()].sort((left, right) => right.score - left.score).slice(0, limit);
  }

  deleteMemory(memoryId: string) {
    if (this.boundDocumentIds.has(memoryId) || !this.baseline) {
      return this.documents.deleteMemory(memoryId);
    }

    return this.baseline.deleteMemory(memoryId);
  }
}
