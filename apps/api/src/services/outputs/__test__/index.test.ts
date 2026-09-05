import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { MistralOcrBatchClient } from "~/lib/providers/capabilities/ocr/batch/MistralOcrBatchClient";
import type { OutputRecord, OutputShareRecord } from "~/repositories/OutputRepository";

const deleteObject = vi.hoisted(() => vi.fn());

vi.mock("~/lib/storage", () => ({
  StorageService: { forPrivateAssets: vi.fn(() => ({ deleteObject })) },
}));

import {
  deleteOutput,
  formatSharedOutput,
  getOutput,
  listOutputRevisions,
  listOutputShares,
  listOutputs,
  restoreOutputRevision,
} from "..";

const provenance = {
  protocolVersion: 1,
  capturedAt: "2026-08-11T10:00:00.000Z",
  completeness: "complete",
  origin: "generated",
  run: { id: "run-1", attempt: 2 },
  model: { id: "model-1", provider: "provider-1" },
  skills: [{ id: "research", name: "Research", revision: 4 }],
  sources: [],
  approvals: [],
};

const output: OutputRecord = {
  id: "output-1",
  created_by_user_id: 42,
  project_id: null,
  conversation_id: null,
  parent_output_id: null,
  capability_id: "notes",
  group_id: null,
  kind: "note",
  title: "Launch notes",
  status: "ready",
  sensitivity: "personal",
  content: "{}",
  storage_key: null,
  mime_type: null,
  filename: null,
  byte_size: null,
  revision: 1,
  provenance_json: JSON.stringify(provenance),
  created_at: "2026-08-11T10:00:00.000Z",
  updated_at: null,
};

function share(overrides: Partial<OutputShareRecord> = {}): OutputShareRecord {
  return {
    id: "share-1",
    output_id: output.id,
    token_hash: "hash",
    permission: "view",
    created_by_user_id: 42,
    expires_at: null,
    revoked_at: null,
    created_at: "2026-08-11T11:00:00.000Z",
    ...overrides,
  };
}

describe("output shares", () => {
  it("removes private scope and storage fields from public output responses", () => {
    const shared = formatSharedOutput({
      ...output,
      project_id: "project-1",
      conversation_id: "conversation-1",
      storage_key: "private/project-1/output-1.pdf",
      mime_type: "application/pdf",
      filename: "launch.pdf",
      byte_size: 100,
    });

    expect(shared).toEqual(
      expect.objectContaining({
        id: "output-1",
        file: {
          mimeType: "application/pdf",
          filename: "launch.pdf",
          byteSize: 100,
        },
      }),
    );
    expect(shared).not.toHaveProperty("createdByUserId");
    expect(shared).not.toHaveProperty("projectId");
    expect(shared).not.toHaveProperty("conversationId");
    expect(shared).not.toHaveProperty("provenance");
    expect(shared.file).not.toHaveProperty("key");
  });

  it("lists only active shares for management", async () => {
    const listShares = vi
      .fn()
      .mockResolvedValue([
        share(),
        share({ id: "share-revoked", revoked_at: "2026-08-11T12:00:00.000Z" }),
        share({ id: "share-expired", expires_at: "2020-01-01T00:00:00.000Z" }),
      ]);
    const context = {
      repositories: {
        outputs: {
          getOutput: vi.fn().mockResolvedValue(output),
          listShares,
        },
      },
    } as unknown as ServiceContext;

    const result = await listOutputShares(context, 42, output.id);

    expect(result).toEqual({
      shares: [
        {
          id: "share-1",
          outputId: output.id,
          permission: "view",
          expiresAt: null,
          revokedAt: null,
          createdAt: "2026-08-11T11:00:00.000Z",
        },
      ],
    });
    expect(listShares).toHaveBeenCalledWith(output.id);
  });
});

describe("output provenance access", () => {
  it("retains the original provenance on historical revisions", async () => {
    const context = {
      repositories: {
        outputs: {
          getOutput: vi.fn().mockResolvedValue(output),
          listRevisions: vi.fn().mockResolvedValue([
            {
              output_id: output.id,
              revision: 1,
              title: output.title,
              status: output.status,
              sensitivity: output.sensitivity,
              content: output.content,
              provenance_json: output.provenance_json,
              created_by_user_id: 42,
              created_at: "2026-08-11T11:00:00.000Z",
            },
          ]),
        },
      },
    } as unknown as ServiceContext;

    const result = await listOutputRevisions(context, 42, output.id);

    expect(result.revisions[0]?.provenance).toEqual(provenance);
    expect(result.current).toMatchObject({
      outputId: output.id,
      revision: 1,
      parentRevision: null,
      operation: "created",
    });
    expect(result.restore).toEqual({
      supported: true,
      reason: null,
      fields: ["title", "content"],
    });
  });

  it("does not reveal personal provenance across owners", async () => {
    const context = {
      repositories: { outputs: { getOutput: vi.fn().mockResolvedValue(output) } },
    } as unknown as ServiceContext;

    await expect(getOutput(context, 7, output.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("marks deleted or inaccessible source references unavailable without exposing a link", async () => {
    const outputWithSource = {
      ...output,
      provenance_json: JSON.stringify({
        ...provenance,
        sources: [{ id: "source-1", name: "Deleted brief", state: "referenced" }],
      }),
    };
    const context = {
      repositories: {
        outputs: { getOutput: vi.fn().mockResolvedValue(outputWithSource) },
        sources: { getSource: vi.fn().mockResolvedValue(null) },
      },
    } as unknown as ServiceContext;

    const result = await getOutput(context, 42, output.id);

    expect(result.provenance.sources).toEqual([
      { id: "source-1", name: "Deleted brief", state: "unavailable" },
    ]);
    expect(result.provenance.sources[0]).not.toHaveProperty("retrievalPath");
  });

  it("requires current workspace membership before returning project provenance", async () => {
    const projectOutput = { ...output, project_id: "project-1", sensitivity: "internal" as const };
    const context = {
      requireUser: () => ({ id: 7, plan_id: "pro" }),
      repositories: {
        outputs: { getOutput: vi.fn().mockResolvedValue(projectOutput) },
        workspaces: {
          getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue(null),
        },
      },
    } as unknown as ServiceContext;

    await expect(getOutput(context, 7, projectOutput.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("output revision restore", () => {
  it("appends an auditable restore without changing status, sensitivity or provenance", async () => {
    const target = {
      output_id: output.id,
      revision: 1,
      title: "Earlier title",
      status: "failed",
      sensitivity: "confidential",
      content: JSON.stringify({ body: "Earlier text" }),
      provenance_json: output.provenance_json,
      created_by_user_id: 42,
      created_at: output.created_at,
      operation: "created",
      restored_from_revision: null,
    };
    const updateOutput = vi.fn().mockResolvedValue({
      ...output,
      revision: 3,
      title: target.title,
      content: target.content,
      revision_operation: "restored",
      restored_from_revision: 1,
    });
    const context = {
      repositories: {
        outputs: {
          getOutput: vi.fn().mockResolvedValue({ ...output, revision: 2 }),
          getRevision: vi.fn().mockResolvedValue(target),
          updateOutput,
        },
      },
    } as unknown as ServiceContext;

    const restored = await restoreOutputRevision(context, 42, output.id, 1, {
      expectedRevision: 2,
    });

    expect(updateOutput).toHaveBeenCalledWith(
      output.id,
      {
        title: "Earlier title",
        content: { body: "Earlier text" },
        expectedRevision: 2,
        updatedByUserId: 42,
        operation: "restored",
        restoredFromRevision: 1,
      },
      undefined,
    );
    expect(restored).toMatchObject({
      revision: 3,
      status: "ready",
      sensitivity: "personal",
      provenance,
    });
  });

  it("rejects a stale revision fence before loading or restoring history", async () => {
    const getRevision = vi.fn();
    const updateOutput = vi.fn();
    const context = {
      repositories: {
        outputs: {
          getOutput: vi.fn().mockResolvedValue({ ...output, revision: 3 }),
          getRevision,
          updateOutput,
        },
      },
    } as unknown as ServiceContext;

    await expect(
      restoreOutputRevision(context, 42, output.id, 1, { expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(getRevision).not.toHaveBeenCalled();
    expect(updateOutput).not.toHaveBeenCalled();
  });

  it("revalidates project membership before loading or restoring history", async () => {
    const getRevision = vi.fn();
    const updateOutput = vi.fn();
    const context = {
      requireUser: () => ({ id: 42, plan_id: "pro" }),
      repositories: {
        outputs: {
          getOutput: vi.fn().mockResolvedValue({
            ...output,
            project_id: "project-1",
            revision: 2,
          }),
          getRevision,
          updateOutput,
        },
        workspaces: {
          getProject: vi.fn().mockResolvedValue({
            id: "project-1",
            workspace_id: "workspace-1",
          }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue(null),
        },
      },
    } as unknown as ServiceContext;

    await expect(
      restoreOutputRevision(context, 42, output.id, 1, { expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(getRevision).not.toHaveBeenCalled();
    expect(updateOutput).not.toHaveBeenCalled();
  });

  it("does not present an external function result as reversible", async () => {
    const updateOutput = vi.fn();
    const context = {
      repositories: {
        outputs: {
          getOutput: vi.fn().mockResolvedValue({
            ...output,
            revision: 2,
            capability_id: "gmail",
            kind: "dynamic_app_response",
          }),
          updateOutput,
        },
      },
    } as unknown as ServiceContext;

    await expect(
      restoreOutputRevision(context, 42, output.id, 1, { expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(updateOutput).not.toHaveBeenCalled();
  });
});

describe("output listing", () => {
  it("passes kind and pagination to persistence instead of filtering an unbounded list", async () => {
    const listPersonalOutputs = vi
      .fn()
      .mockResolvedValue([
        output,
        { ...output, id: "deleting-output", content: JSON.stringify({ deletionPending: true }) },
      ]);
    const context = {
      repositories: { outputs: { listPersonalOutputs } },
    } as unknown as ServiceContext;

    const result = await listOutputs(context, 42, {
      capabilityId: "notes",
      kind: "document",
      limit: 20,
      offset: 40,
    });

    expect(listPersonalOutputs).toHaveBeenCalledWith(42, "notes", {
      kind: "document",
      limit: 20,
      offset: 40,
    });
    expect(result.outputs).toHaveLength(1);
  });
});

describe("output deletion", () => {
  it("blocks result deletion while its OCR batch parent is still pending", async () => {
    const resultOutput = {
      ...output,
      id: "ocr-batch-result:batch-output-1",
      parent_output_id: "batch-output-1",
      capability_id: "ocr",
      kind: "ocr_batch_result",
    };
    const batchOutput = {
      ...output,
      id: "batch-output-1",
      capability_id: "ocr",
      kind: "ocr_batch",
      status: "pending" as const,
      content: JSON.stringify({
        batchStatus: "persisting",
        resultOutputId: resultOutput.id,
      }),
    };
    const updateOutput = vi.fn();
    const deleteOutputs = vi.fn();
    const context = {
      repositories: {
        outputs: {
          getOutputIncludingDeleting: vi
            .fn()
            .mockResolvedValueOnce(resultOutput)
            .mockResolvedValueOnce(batchOutput),
          updateOutput,
          deleteOutputs,
        },
      },
    } as unknown as ServiceContext;

    await expect(deleteOutput(context, 42, resultOutput.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(updateOutput).not.toHaveBeenCalled();
    expect(deleteOutputs).not.toHaveBeenCalled();
  });

  it("clears a terminal OCR batch result pointer before deleting its child", async () => {
    const resultOutput = {
      ...output,
      id: "ocr-batch-result:batch-output-1",
      parent_output_id: "batch-output-1",
      capability_id: "ocr",
      kind: "ocr_batch_result",
      storage_key: "ocr/users/42/batch-output-1/results.jsonl",
    };
    const batchOutput = {
      ...output,
      id: "batch-output-1",
      capability_id: "ocr",
      kind: "ocr_batch",
      content: JSON.stringify({
        batchStatus: "completed",
        resultOutputId: resultOutput.id,
      }),
    };
    const updateOutput = vi
      .fn()
      .mockResolvedValueOnce({ ...batchOutput, revision: 2, content: "{}" })
      .mockResolvedValueOnce({
        ...resultOutput,
        revision: 2,
        status: "failed",
        content: JSON.stringify({ deletionPending: true }),
      });
    const deleteOutputs = vi.fn().mockResolvedValue(undefined);

    deleteObject.mockResolvedValue(undefined);
    const context = {
      repositories: {
        outputs: {
          getOutputIncludingDeleting: vi
            .fn()
            .mockResolvedValueOnce(resultOutput)
            .mockResolvedValueOnce(batchOutput),
          listOutputDescendants: vi.fn().mockResolvedValue([]),
          updateOutput,
          deleteOutputs,
        },
      },
    } as unknown as ServiceContext;

    await deleteOutput(context, 42, resultOutput.id);

    expect(updateOutput).toHaveBeenNthCalledWith(
      1,
      batchOutput.id,
      expect.objectContaining({
        expectedRevision: 1,
        content: expect.not.objectContaining({ resultOutputId: resultOutput.id }),
      }),
      undefined,
    );
    expect(deleteOutputs).toHaveBeenCalledWith([resultOutput.id]);
  });

  it("tombstones metadata until private-object deletion succeeds", async () => {
    const storedOutput = {
      ...output,
      storage_key: "private/users/42/output-1.pdf",
      mime_type: "application/pdf",
    };
    const deleteOutputs = vi.fn().mockResolvedValue(undefined);

    deleteObject.mockResolvedValue(undefined);
    const context = {
      repositories: {
        outputs: {
          getOutputIncludingDeleting: vi.fn().mockResolvedValue(storedOutput),
          listOutputDescendants: vi.fn().mockResolvedValue([]),
          updateOutput: vi.fn().mockResolvedValue({
            ...storedOutput,
            status: "failed",
            revision: 2,
            content: JSON.stringify({ deletionPending: true }),
          }),
          deleteOutputs,
        },
      },
    } as unknown as ServiceContext;

    await deleteOutput(context, 42, storedOutput.id);

    expect(deleteOutputs).toHaveBeenCalledWith([storedOutput.id]);
    expect(deleteObject).toHaveBeenCalledWith(storedOutput.storage_key);
    expect(deleteObject.mock.invocationCallOrder[0]).toBeLessThan(
      deleteOutputs.mock.invocationCallOrder[0],
    );
  });

  it("retains tombstones and cleanup keys when private-object deletion fails", async () => {
    const storedOutput = {
      ...output,
      storage_key: "private/users/42/output-1.pdf",
      mime_type: "application/pdf",
    };
    const deleteOutputs = vi.fn();

    deleteObject.mockRejectedValueOnce(new Error("R2 unavailable"));
    const context = {
      repositories: {
        outputs: {
          getOutputIncludingDeleting: vi.fn().mockResolvedValue(storedOutput),
          listOutputDescendants: vi.fn().mockResolvedValue([]),
          updateOutput: vi.fn().mockResolvedValue({
            ...storedOutput,
            status: "failed",
            revision: 2,
            content: JSON.stringify({ deletionPending: true }),
          }),
          deleteOutputs,
        },
      },
    } as unknown as ServiceContext;

    await expect(deleteOutput(context, 42, storedOutput.id)).rejects.toThrow("R2 unavailable");
    expect(deleteOutputs).not.toHaveBeenCalled();
  });

  it("uses the batch creator's provider credentials when an admin deletes a project batch", async () => {
    const batchOutput = {
      ...output,
      capability_id: "ocr",
      kind: "ocr_batch",
      project_id: "project-1",
      created_by_user_id: 42,
      status: "pending",
      content: JSON.stringify({ batchStatus: "running", providerJobId: "provider-job-1" }),
    };
    const creator = { id: 42, plan_id: "pro" };
    const cancel = vi.spyOn(MistralOcrBatchClient.prototype, "cancel").mockResolvedValue({
      id: "provider-job-1",
      status: "CANCELLED",
      total_requests: 1,
      completed_requests: 0,
      succeeded_requests: 0,
      failed_requests: 0,
    });

    vi.spyOn(MistralOcrBatchClient.prototype, "deleteJob").mockResolvedValue(undefined);
    vi.spyOn(MistralOcrBatchClient.prototype, "deleteFile").mockResolvedValue(undefined);
    const updateOutput = vi
      .fn()
      .mockResolvedValueOnce({
        ...batchOutput,
        revision: 2,
        content: JSON.stringify({
          batchStatus: "deletion_pending",
          providerJobId: "provider-job-1",
          deletionPending: true,
        }),
      })
      .mockResolvedValueOnce({
        ...batchOutput,
        revision: 3,
        status: "failed",
        content: JSON.stringify({
          batchStatus: "deletion_pending",
          providerJobId: "provider-job-1",
          deletionPending: true,
          providerCleanup: { jobId: "provider-job-1" },
        }),
      })
      .mockResolvedValueOnce({
        ...batchOutput,
        revision: 4,
        status: "failed",
        content: JSON.stringify({
          batchStatus: "deletion_pending",
          providerJobId: "provider-job-1",
          deletionPending: true,
        }),
      });
    const context = {
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      env: {},
      repositories: {
        users: { getUserById: vi.fn().mockResolvedValue(creator) },
        outputs: {
          getOutputIncludingDeleting: vi.fn().mockResolvedValue(batchOutput),
          listOutputDescendants: vi.fn().mockResolvedValue([]),
          updateOutput,
          deleteOutputs: vi.fn().mockResolvedValue(undefined),
        },
        workspaces: {
          getProject: vi.fn().mockResolvedValue({
            id: "project-1",
            workspace_id: "workspace-1",
          }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue({ role: "admin" }),
        },
      },
    } as unknown as ServiceContext;

    await deleteOutput(context, 7, batchOutput.id);

    expect(cancel).toHaveBeenCalledWith(
      expect.objectContaining({ user: creator, jobId: "provider-job-1" }),
    );
  });
});
