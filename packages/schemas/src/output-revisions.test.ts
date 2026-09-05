import { describe, expect, it } from "vitest";

import { outputHistoryResponseSchema, restoreOutputRevisionSchema } from "./outputs";

const provenance = {
  protocolVersion: 1,
  capturedAt: "2026-09-05T12:00:00.000Z",
  completeness: "complete",
  origin: "generated",
  run: { id: "run-1", attempt: 2 },
  model: { id: "model-1", provider: "provider-1" },
  skills: [],
  sources: [],
  approvals: [],
} as const;

describe("output revision contracts", () => {
  it("carries parent, restore and immutable provenance lineage", () => {
    const revision = {
      outputId: "output-1",
      revision: 3,
      parentRevision: 2,
      title: "Restored draft",
      status: "ready",
      sensitivity: "personal",
      content: { body: "Earlier text" },
      createdByUserId: 42,
      createdAt: "2026-09-05T13:00:00.000Z",
      operation: "restored",
      restoredFromRevision: 1,
      provenance,
    } as const;

    expect(
      outputHistoryResponseSchema.parse({
        current: revision,
        revisions: [{ ...revision, revision: 1, parentRevision: null }],
        restore: { supported: true, reason: null, fields: ["title", "content"] },
      }),
    ).toMatchObject({ current: { operation: "restored", restoredFromRevision: 1 } });
  });

  it("requires a positive current-revision fence for restore", () => {
    expect(restoreOutputRevisionSchema.safeParse({ expectedRevision: 3 }).success).toBe(true);
    expect(restoreOutputRevisionSchema.safeParse({ expectedRevision: 0 }).success).toBe(false);
  });
});
