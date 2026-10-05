import type { MemoryDocument } from "@ngriffin_uk/polychat-schemas";

export function memoryDocumentFixture(overrides: Partial<MemoryDocument> = {}): MemoryDocument {
  return {
    id: "memory",
    name: "working-memory",
    content: "Prefer concise answers",
    tier: "core",
    summary: "Answer preferences",
    revision: 1,
    scopeType: "personal",
    scopeId: "1",
    createdAt: "2026-10-04",
    updatedAt: "2026-10-04",
    ...overrides,
  };
}
