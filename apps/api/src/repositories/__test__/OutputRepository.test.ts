import { describe, expect, it, vi } from "vitest";

import { OutputRepository } from "../OutputRepository";

describe("OutputRepository", () => {
  it("revokes a share without updating columns absent from output_share", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new OutputRepository({ DB: { prepare } } as any);

    await repository.revokeShare("output-1", "share-1");

    expect(prepare).toHaveBeenCalledWith(
      "UPDATE output_share SET revoked_at = ? WHERE id = ? AND output_id = ? AND revoked_at IS NULL",
    );
    expect(bind).toHaveBeenCalledWith(expect.any(String), "share-1", "output-1");
    expect(run).toHaveBeenCalledOnce();
  });

  it("snapshots revision lineage and appends a restored current revision atomically", async () => {
    const existing = {
      id: "output-1",
      created_by_user_id: 42,
      project_id: null,
      conversation_id: null,
      parent_output_id: null,
      capability_id: "notes",
      group_id: null,
      kind: "note",
      title: "Current",
      status: "ready",
      sensitivity: "personal",
      content: JSON.stringify({ body: "Current" }),
      storage_key: null,
      mime_type: null,
      filename: null,
      byte_size: null,
      revision: 2,
      provenance_json: null,
      revision_created_by_user_id: 41,
      revision_created_at: "2026-09-05T10:00:00.000Z",
      revision_operation: "updated",
      restored_from_revision: null,
      created_at: "2026-09-05T09:00:00.000Z",
      updated_at: "2026-09-05T10:00:00.000Z",
    };
    const updated = {
      ...existing,
      revision: 3,
      title: "Earlier",
      revision_created_by_user_id: 42,
      revision_operation: "restored",
      restored_from_revision: 1,
    };
    const first = vi.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
    const all = vi.fn().mockResolvedValue({ results: [] });
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ all, first, run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const batch = vi.fn().mockResolvedValue([
      { success: true, results: [], meta: { changes: 1 } },
      { success: true, results: [], meta: { changes: 1 } },
    ]);
    const repository = new OutputRepository({ DB: { batch, prepare } } as any);

    await expect(
      repository.updateOutput("output-1", {
        title: "Earlier",
        content: { body: "Earlier" },
        expectedRevision: 2,
        updatedByUserId: 42,
        operation: "restored",
        restoredFromRevision: 1,
      }),
    ).resolves.toMatchObject({ revision: 3, revision_operation: "restored" });

    const queries = prepare.mock.calls.map(([query]) => query);
    const revisionInsertIndex = queries.findIndex((query) =>
      query.includes("INSERT OR IGNORE INTO output_revision"),
    );

    expect(revisionInsertIndex).toBeGreaterThan(-1);
    expect(queries).toContainEqual(expect.stringContaining("WHERE id = ? AND revision = ?"));
    expect(bind.mock.calls[revisionInsertIndex]).toEqual([
      "output-1",
      2,
      "Current",
      "ready",
      "personal",
      existing.content,
      null,
      41,
      existing.revision_created_at,
      "updated",
      null,
    ]);
  });

  it("reports a conflict when a concurrent revision wins the compare-and-swap", async () => {
    const existing = {
      id: "output-1",
      created_by_user_id: 42,
      project_id: null,
      capability_id: "notes",
      kind: "note",
      title: "Current",
      status: "ready",
      sensitivity: "personal",
      content: "{}",
      revision: 2,
      provenance_json: null,
      created_at: "2026-09-05T09:00:00.000Z",
      updated_at: null,
    };
    const first = vi
      .fn()
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...existing, revision: 3 });
    const bind = vi.fn().mockReturnValue({
      first,
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    });
    const prepare = vi.fn().mockReturnValue({ bind });
    const batch = vi.fn().mockResolvedValue([
      { success: true, results: [], meta: { changes: 0 } },
      { success: true, results: [], meta: { changes: 0 } },
    ]);
    const repository = new OutputRepository({ DB: { batch, prepare } } as any);

    await expect(
      repository.updateOutput("output-1", {
        title: "Stale",
        expectedRevision: 2,
        updatedByUserId: 42,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
