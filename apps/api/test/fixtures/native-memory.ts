import type { MemoryDocumentRow } from "~/infrastructure/database/schema";

export function memoryDocumentFixture(
  overrides: Partial<MemoryDocumentRow> = {},
): MemoryDocumentRow {
  return {
    id: "memory",
    name: "working-memory",
    kind: "teammate_context",
    content: "Prefer concise answers",
    revision: 1,
    scope_type: "personal",
    scope_id: "1",
    created_by: 1,
    deleted_at: null,
    created_at: "2026-10-04",
    updated_at: "2026-10-04",
    ...overrides,
  };
}
