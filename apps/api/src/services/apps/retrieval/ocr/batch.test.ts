import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IUser } from "~/types";

import { startOcrBatch } from "./batch";

const {
  createOutput,
  enqueueTask,
  getOutput,
  readPrivateFile,
  requireOcrAccess,
  requireOutputAccess,
  requireProjectAccess,
  updateOutput,
} = vi.hoisted(() => ({
  createOutput: vi.fn(),
  getOutput: vi.fn(),
  updateOutput: vi.fn(),
  enqueueTask: vi.fn(),
  readPrivateFile: vi.fn(),
  requireOcrAccess: vi.fn(),
  requireOutputAccess: vi.fn(),
  requireProjectAccess: vi.fn(),
}));

vi.mock("~/services/outputs", () => ({
  createOutput,
  getOutput,
  updateOutput,
}));

vi.mock("~/services/tasks/TaskService", () => ({
  TaskService: class {
    enqueueTask = enqueueTask;
  },
}));

vi.mock("~/lib/storage/read-resource", () => ({ readPrivateFile }));
vi.mock("~/lib/providers/capabilities/ocr/access", () => ({ requireOcrAccess }));
vi.mock("~/services/outputs/access", () => ({ requireOutputAccess }));
vi.mock("~/services/workspaces/access", () => ({ requireProjectAccess }));

describe("startOcrBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOcrAccess.mockResolvedValue(undefined);
    requireOutputAccess.mockResolvedValue({});
    requireProjectAccess.mockResolvedValue({});
    createOutput.mockResolvedValue({
      id: "batch-output-1",
      revision: 1,
      content: {},
    });
    updateOutput.mockResolvedValue({
      id: "batch-output-1",
      revision: 2,
      content: {},
    });
    enqueueTask.mockResolvedValue("ocr-batch:batch-output-1:0");
  });

  it("starts a scoped provider job and enqueues deterministic polling", async () => {
    const batchClient = {
      start: vi.fn().mockResolvedValue({
        id: "provider-job-1",
        status: "QUEUED",
        total_requests: 1,
        completed_requests: 0,
        succeeded_requests: 0,
        failed_requests: 0,
      }),
      cancel: vi.fn(),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
    };
    const context = {
      env: {},
      repositories: {
        outputs: { attachSources: vi.fn() },
        tasks: {},
      },
    } as unknown as ServiceContext;
    const user = { id: 42 } as IUser;

    const result = await startOcrBatch(
      context,
      user,
      {
        title: "Archive OCR",
        model: "mistral-ocr-latest",
        requests: [
          {
            document: {
              type: "document_url",
              document_url: "https://example.com/report.pdf",
            },
            include_blocks: true,
          },
        ],
      },
      { projectId: "project-1", batchClient },
    );

    expect(result).toEqual({ outputId: "batch-output-1", status: "pending" });
    expect(requireOcrAccess).toHaveBeenCalledWith({
      env: context.env,
      user,
      providerName: "mistral",
    });
    expect(createOutput).toHaveBeenCalledWith(
      context,
      42,
      expect.objectContaining({
        projectId: "project-1",
        capabilityId: "ocr",
        kind: "ocr_batch",
        status: "pending",
      }),
    );
    expect(batchClient.start).toHaveBeenCalledWith(
      expect.objectContaining({
        env: context.env,
        user,
        model: "mistral-ocr-latest",
        metadata: { outputId: "batch-output-1" },
        requests: [
          expect.objectContaining({ body: expect.objectContaining({ include_blocks: true }) }),
        ],
      }),
    );
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ocr-batch:batch-output-1:0",
        task_type: "ocr_batch_polling",
        user_id: 42,
        project_id: "project-1",
        task_data: expect.objectContaining({
          outputId: "batch-output-1",
          jobId: "provider-job-1",
          pollAttempt: 0,
        }),
      }),
    );
  });

  it("rejects users without OCR access before provider spend", async () => {
    requireOcrAccess.mockRejectedValueOnce(new Error("OCR access denied"));
    const batchClient = {
      start: vi.fn(),
      cancel: vi.fn(),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
    };
    const context = { env: {}, repositories: {} } as unknown as ServiceContext;

    await expect(
      startOcrBatch(
        context,
        { id: 42 } as IUser,
        {
          title: "Denied",
          model: "mistral-ocr-latest",
          requests: [
            {
              document: {
                type: "document_url",
                document_url: "https://example.com/report.pdf",
              },
            },
          ],
        },
        { batchClient },
      ),
    ).rejects.toThrow("OCR access denied");
    expect(createOutput).not.toHaveBeenCalled();
    expect(batchClient.start).not.toHaveBeenCalled();
  });

  it("persists cleanup state and reconciles when the first poll cannot be queued", async () => {
    const created = {
      id: "batch-output-1",
      revision: 1,
      status: "pending",
      content: { batchStatus: "submitting" },
    };
    const providerOutput = {
      ...created,
      revision: 2,
      content: { batchStatus: "queued", providerJobId: "provider-job-1" },
    };
    const cleanupOutput = {
      ...providerOutput,
      revision: 3,
      content: {
        ...providerOutput.content,
        batchStatus: "cleanup_pending",
        providerCleanup: { jobId: "provider-job-1" },
      },
    };
    const batchClient = {
      start: vi.fn().mockResolvedValue({
        id: "provider-job-1",
        status: "QUEUED",
        total_requests: 1,
        completed_requests: 0,
        succeeded_requests: 0,
        failed_requests: 0,
      }),
      cancel: vi.fn().mockResolvedValue({
        id: "provider-job-1",
        status: "CANCELLED",
        total_requests: 1,
        completed_requests: 0,
        succeeded_requests: 0,
        failed_requests: 0,
      }),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
    };
    const context = {
      env: {},
      repositories: { outputs: { attachSources: vi.fn() }, tasks: {} },
    } as unknown as ServiceContext;

    createOutput.mockResolvedValueOnce(created);
    getOutput.mockResolvedValueOnce(providerOutput);
    updateOutput
      .mockResolvedValueOnce(providerOutput)
      .mockResolvedValueOnce(cleanupOutput)
      .mockResolvedValueOnce({
        ...cleanupOutput,
        revision: 4,
        status: "failed",
        content: { ...providerOutput.content, batchStatus: "failed" },
      });
    enqueueTask
      .mockRejectedValueOnce(new Error("queue unavailable"))
      .mockResolvedValueOnce("ocr-batch:batch-output-1:reconcile");

    await expect(
      startOcrBatch(
        context,
        { id: 42 } as IUser,
        {
          title: "Recovery",
          model: "mistral-ocr-latest",
          requests: [
            {
              document: {
                type: "document_url",
                document_url: "https://example.com/report.pdf",
              },
            },
          ],
        },
        { batchClient },
      ),
    ).rejects.toThrow("queue unavailable");

    expect(batchClient.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "provider-job-1" }),
    );
    expect(batchClient.deleteJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "provider-job-1" }),
    );
    expect(updateOutput).toHaveBeenCalledWith(
      context,
      42,
      "batch-output-1",
      expect.objectContaining({
        status: "failed",
        expectedRevision: 3,
        content: expect.objectContaining({ batchStatus: "failed" }),
      }),
    );
    expect(enqueueTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "ocr-batch:batch-output-1:reconcile" }),
    );
  });

  it("resolves authorised private Sources without putting bytes into the queue", async () => {
    const batchClient = {
      start: vi.fn().mockResolvedValue({
        id: "provider-job-2",
        status: "QUEUED",
        total_requests: 1,
        completed_requests: 0,
        succeeded_requests: 0,
        failed_requests: 0,
      }),
      cancel: vi.fn(),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
    };
    const attachSources = vi.fn();
    const context = {
      env: {},
      repositories: { outputs: { attachSources }, tasks: {} },
    } as unknown as ServiceContext;
    const user = { id: 42 } as IUser;

    readPrivateFile.mockResolvedValue({
      record: {
        created_by_user_id: 42,
        storage_key: "uploads/42/documents/report.pdf",
        mime_type: "application/pdf",
        filename: "report.pdf",
      },
      object: {
        arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("pdf").buffer),
      },
    });

    await startOcrBatch(
      context,
      user,
      {
        title: "Private OCR",
        model: "mistral-ocr-latest",
        requests: [{ document: { type: "source", source_id: "source-1" } }],
      },
      { batchClient },
    );

    expect(readPrivateFile).toHaveBeenCalledWith({
      context,
      kind: "source",
      resourceId: "source-1",
      userId: 42,
    });
    expect(batchClient.start).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [
          expect.objectContaining({
            body: expect.objectContaining({
              document: expect.objectContaining({
                type: "document_url",
                document_url: "data:application/pdf;base64,cGRm",
                document_name: "report.pdf",
              }),
            }),
          }),
        ],
      }),
    );
    expect(attachSources).toHaveBeenCalledWith("batch-output-1", ["source-1"]);
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_data: expect.not.objectContaining({ document_url: expect.anything() }),
      }),
    );
  });

  it("rejects a private input outside the requested project scope before provider spend", async () => {
    const batchClient = {
      start: vi.fn(),
      cancel: vi.fn(),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
    };
    const context = {
      env: {},
      repositories: { outputs: { attachSources: vi.fn() }, tasks: {} },
    } as unknown as ServiceContext;

    readPrivateFile.mockResolvedValue({
      record: {
        project_id: "project-2",
        storage_key: "uploads/42/documents/report.pdf",
        mime_type: "application/pdf",
        filename: "report.pdf",
      },
      object: { arrayBuffer: vi.fn() },
    });

    await expect(
      startOcrBatch(
        context,
        { id: 42 } as IUser,
        {
          title: "Wrong project",
          model: "mistral-ocr-latest",
          requests: [{ document: { type: "source", source_id: "source-1" } }],
        },
        { projectId: "project-1", batchClient },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(batchClient.start).not.toHaveBeenCalled();
    expect(createOutput).not.toHaveBeenCalled();
  });
});

describe("cancelOcrBatch", () => {
  it("cancels the provider job and exposes a terminal batch state", async () => {
    const { cancelOcrBatch } = await import("./batch");
    const batchClient = {
      start: vi.fn(),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
      cancel: vi.fn().mockResolvedValue({ id: "provider-job-1", status: "CANCELLED" }),
    };
    const context = { env: {}, repositories: {} } as unknown as ServiceContext;
    const user = { id: 42 } as IUser;
    const output = {
      id: "batch-output-1",
      capabilityId: "ocr",
      kind: "ocr_batch",
      status: "pending",
      revision: 2,
      content: { providerJobId: "provider-job-1", batchStatus: "running" },
    };

    getOutput.mockResolvedValue(output);
    updateOutput.mockResolvedValue({
      ...output,
      revision: 3,
      status: "failed",
      content: { ...output.content, batchStatus: "cancelled" },
    });

    const result = await cancelOcrBatch(context, user, "batch-output-1", { batchClient });

    expect(requireOutputAccess).toHaveBeenCalledWith(context, 42, "batch-output-1", true);
    expect(batchClient.cancel).toHaveBeenCalledWith({
      env: context.env,
      user,
      jobId: "provider-job-1",
    });
    expect(updateOutput).toHaveBeenCalledWith(
      context,
      42,
      "batch-output-1",
      expect.objectContaining({
        status: "failed",
        expectedRevision: 3,
        content: expect.objectContaining({ batchStatus: "cancelled" }),
      }),
    );
    expect(result).toEqual({ outputId: "batch-output-1", status: "cancelled" });
  });

  it("keeps polling while provider cancellation is only requested", async () => {
    const { cancelOcrBatch } = await import("./batch");
    const batchClient = {
      start: vi.fn(),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
      cancel: vi.fn().mockResolvedValue({ id: "provider-job-1", status: "CANCELLATION_REQUESTED" }),
    };
    const context = { env: {}, repositories: {} } as unknown as ServiceContext;
    const user = { id: 42 } as IUser;
    const output = {
      id: "batch-output-1",
      capabilityId: "ocr",
      kind: "ocr_batch",
      status: "pending",
      revision: 2,
      content: { providerJobId: "provider-job-1", batchStatus: "running" },
    };

    requireOutputAccess.mockResolvedValueOnce({});
    getOutput.mockResolvedValueOnce(output);
    updateOutput.mockResolvedValueOnce({
      ...output,
      revision: 3,
      content: { ...output.content, batchStatus: "cancellation_requested" },
    });

    await expect(cancelOcrBatch(context, user, "batch-output-1", { batchClient })).resolves.toEqual(
      { outputId: "batch-output-1", status: "cancellation_requested" },
    );
    expect(updateOutput).toHaveBeenCalledWith(
      context,
      42,
      "batch-output-1",
      expect.objectContaining({
        status: "pending",
        content: expect.objectContaining({ batchStatus: "cancellation_requested" }),
      }),
    );
  });
});
