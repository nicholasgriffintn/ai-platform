import { OCR_BATCH_POLLING_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResponseBodyTooLargeError } from "~/utils/http";

import { OcrBatchPollingHandler } from "../OcrBatchPollingHandler";

const {
  createServiceContext,
  createOutput,
  deleteObject,
  enqueueTask,
  getObjectBody,
  getOutput,
  getUserById,
  requireProjectAccess,
  updateOutput,
  uploadObject,
} = vi.hoisted(() => ({
  createServiceContext: vi.fn(),
  createOutput: vi.fn(),
  deleteObject: vi.fn(),
  enqueueTask: vi.fn(),
  getObjectBody: vi.fn(),
  getOutput: vi.fn(),
  getUserById: vi.fn(),
  requireProjectAccess: vi.fn(),
  updateOutput: vi.fn(),
  uploadObject: vi.fn(),
}));

vi.mock("~/lib/context/serviceContext", () => ({ createServiceContext }));
vi.mock("~/repositories", () => ({
  RepositoryManager: class {
    users = { getUserById };
  },
}));
vi.mock("~/services/outputs", () => ({
  createOutput,
  getOutput,
  getOutputIncludingDeleting: getOutput,
  updateOutput,
}));
vi.mock("~/lib/storage", () => ({
  StorageService: {
    forPrivateAssets: vi.fn(() => ({ deleteObject, getObjectBody, uploadObject })),
  },
}));
vi.mock("~/services/tasks/TaskService", () => ({
  TaskService: class {
    enqueueTask = enqueueTask;
  },
}));
vi.mock("~/services/workspaces/access", () => ({ requireProjectAccess }));

describe("OcrBatchPollingHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserById.mockResolvedValue({ id: 42, plan_id: "pro" });
    createServiceContext.mockReturnValue({
      env: {},
      repositories: {
        tasks: {},
        outputs: {
          attachSources: vi.fn(),
          getOutputByCapabilityAndGroup: vi.fn().mockResolvedValue(null),
        },
      },
    });
    getOutput.mockResolvedValue({
      id: "batch-output-1",
      createdByUserId: 42,
      capabilityId: "ocr",
      kind: "ocr_batch",
      status: "pending",
      revision: 2,
      projectId: "project-1",
      content: { batchStatus: "queued", providerJobId: "provider-job-1", inputs: [] },
    });
    updateOutput.mockResolvedValue({ revision: 3 });
    enqueueTask.mockResolvedValue("ocr-batch:batch-output-1:1");
    uploadObject.mockResolvedValue(undefined);
    deleteObject.mockResolvedValue(undefined);
    getObjectBody.mockResolvedValue(null);
  });

  it("revalidates project membership and deterministically requeues a running batch", async () => {
    const batchClient = {
      start: vi.fn(),
      cancel: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
      get: vi.fn().mockResolvedValue({
        id: "provider-job-1",
        status: "RUNNING",
        total_requests: 4,
        completed_requests: 2,
        succeeded_requests: 2,
        failed_requests: 0,
      }),
    };
    const handler = new OcrBatchPollingHandler({ batchClient });
    const startedAt = new Date().toISOString();
    const result = await handler.handle(
      {
        taskId: "ocr-batch:batch-output-1:0",
        task_type: OCR_BATCH_POLLING_TASK_TYPE,
        user_id: 42,
        project_id: "project-1",
        priority: 5,
        task_data: {
          outputId: "batch-output-1",
          jobId: "provider-job-1",
          userId: 42,
          projectId: "project-1",
          model: "mistral-ocr-latest",
          startedAt,
          pollAttempt: 0,
        },
      },
      {} as never,
    );

    expect(result.status).toBe("success");
    expect(requireProjectAccess).toHaveBeenCalledWith(expect.anything(), "project-1");
    expect(updateOutput).toHaveBeenCalledWith(
      expect.anything(),
      42,
      "batch-output-1",
      expect.objectContaining({
        expectedRevision: 2,
        status: "pending",
        content: expect.objectContaining({
          batchStatus: "running",
          progress: { total: 4, completed: 2, succeeded: 2, failed: 0 },
        }),
      }),
    );
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ocr-batch:batch-output-1:1",
        task_type: OCR_BATCH_POLLING_TASK_TYPE,
        task_data: expect.objectContaining({ pollAttempt: 1 }),
        schedule_type: "scheduled",
      }),
    );
  });

  it("persists partial terminal results as a scoped child Output", async () => {
    const attachSources = vi.fn();
    const context = {
      env: {},
      repositories: {
        tasks: {},
        outputs: {
          attachSources,
          getOutputIncludingDeleting: vi.fn().mockResolvedValue(null),
          getOutputByCapabilityAndGroup: vi.fn().mockResolvedValue(null),
        },
      },
    };

    createServiceContext.mockReturnValue(context);
    const batchOutput = {
      id: "batch-output-1",
      createdByUserId: 42,
      capabilityId: "ocr",
      kind: "ocr_batch",
      title: "Archive OCR",
      status: "pending",
      revision: 2,
      projectId: "project-1",
      conversationId: null,
      content: {
        batchStatus: "running",
        providerJobId: "provider-job-1",
        inputs: [
          { customId: "input-1", type: "source", resourceId: "source-1" },
          { customId: "input-2", type: "source", resourceId: "source-2" },
        ],
      },
    };

    getOutput.mockResolvedValue(batchOutput);
    createOutput.mockResolvedValue({ id: "ocr-batch-result:batch-output-1", revision: 1 });
    updateOutput
      .mockResolvedValueOnce({
        ...batchOutput,
        revision: 3,
        content: { ...batchOutput.content, batchStatus: "persisting" },
      })
      .mockResolvedValueOnce({
        ...batchOutput,
        revision: 4,
        status: "ready",
        content: {
          ...batchOutput.content,
          batchStatus: "partial",
          resultOutputId: "ocr-batch-result:batch-output-1",
          providerCleanup: { jobId: "provider-job-1" },
        },
      })
      .mockResolvedValueOnce({ ...batchOutput, revision: 5, status: "ready" });
    const batchClient = {
      start: vi.fn(),
      cancel: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
      get: vi.fn().mockResolvedValue({
        id: "provider-job-1",
        status: "SUCCESS",
        total_requests: 2,
        completed_requests: 2,
        succeeded_requests: 1,
        failed_requests: 1,
        outputs: [
          {
            custom_id: "input-1",
            response: {
              status_code: 200,
              body: { model: "mistral-ocr-4-1", pages: [{ index: 0, markdown: "Text" }] },
            },
          },
          { custom_id: "input-2", error: { message: "Unreadable document" } },
        ],
      }),
    };
    const handler = new OcrBatchPollingHandler({ batchClient });
    const message = {
      taskId: "ocr-batch:batch-output-1:1",
      task_type: OCR_BATCH_POLLING_TASK_TYPE,
      user_id: 42,
      project_id: "project-1",
      priority: 5,
      task_data: {
        outputId: "batch-output-1",
        jobId: "provider-job-1",
        userId: 42,
        projectId: "project-1",
        model: "mistral-ocr-latest",
        startedAt: new Date().toISOString(),
        pollAttempt: 1,
      },
    } as const;
    const result = await handler.handle(message, {} as never);

    expect(result).toMatchObject({
      status: "success",
      data: {
        outputId: "batch-output-1",
        resultOutputId: "ocr-batch-result:batch-output-1",
      },
    });
    expect(uploadObject).toHaveBeenCalledWith(
      expect.stringContaining("ocr/projects/project-1/batch-output-1/"),
      expect.stringContaining('"custom_id":"input-1"'),
      expect.objectContaining({ httpMetadata: { contentType: "application/x-ndjson" } }),
    );
    expect(createOutput).toHaveBeenCalledWith(
      context,
      42,
      expect.objectContaining({
        parentOutputId: "batch-output-1",
        projectId: "project-1",
        capabilityId: "ocr",
        kind: "ocr_batch_result",
        status: "ready",
      }),
      { id: "ocr-batch-result:batch-output-1" },
    );
    expect(attachSources).toHaveBeenCalledWith("ocr-batch-result:batch-output-1", [
      "source-1",
      "source-2",
    ]);
    expect(updateOutput).toHaveBeenLastCalledWith(
      context,
      42,
      "batch-output-1",
      expect.objectContaining({
        status: "ready",
        content: expect.objectContaining({
          batchStatus: "partial",
          resultOutputId: "ocr-batch-result:batch-output-1",
        }),
      }),
    );
    expect(enqueueTask).not.toHaveBeenCalled();

    context.repositories.outputs.getOutputIncludingDeleting.mockResolvedValueOnce({
      id: "ocr-batch-result:batch-output-1",
      capability_id: "ocr",
      kind: "ocr_batch_result",
      parent_output_id: "batch-output-1",
      created_by_user_id: 42,
      project_id: "project-1",
      storage_key: "ocr/projects/project-1/batch-output-1/results.jsonl",
    });
    getObjectBody.mockResolvedValueOnce({});
    getOutput.mockResolvedValueOnce({
      ...batchOutput,
      revision: 5,
      content: { ...batchOutput.content, batchStatus: "persisting" },
    });
    updateOutput
      .mockResolvedValueOnce({
        ...batchOutput,
        revision: 6,
        status: "ready",
        content: {
          ...batchOutput.content,
          batchStatus: "partial",
          resultOutputId: "ocr-batch-result:batch-output-1",
          providerCleanup: { jobId: "provider-job-1" },
        },
      })
      .mockResolvedValueOnce({ ...batchOutput, revision: 7, status: "ready" });
    await handler.handle(message, {} as never);
    expect(createOutput).toHaveBeenCalledTimes(1);
    expect(uploadObject).toHaveBeenCalledTimes(1);
  });

  it("does not revive a batch result that is being deleted", async () => {
    const context = {
      env: {},
      repositories: {
        tasks: {},
        outputs: {
          attachSources: vi.fn(),
          getOutputIncludingDeleting: vi.fn().mockResolvedValue({
            id: "ocr-batch-result:batch-output-1",
            capability_id: "ocr",
            kind: "ocr_batch_result",
            parent_output_id: "batch-output-1",
            created_by_user_id: 42,
            project_id: "project-1",
            storage_key: "ocr/projects/project-1/batch-output-1/results.jsonl",
            content: JSON.stringify({ deletionPending: true }),
          }),
        },
      },
    };
    const batchOutput = {
      id: "batch-output-1",
      createdByUserId: 42,
      capabilityId: "ocr",
      kind: "ocr_batch",
      title: "Archive OCR",
      status: "pending",
      revision: 3,
      projectId: "project-1",
      conversationId: null,
      content: {
        batchStatus: "persisting",
        providerJobId: "provider-job-1",
        inputs: [],
      },
    };
    const batchClient = {
      start: vi.fn(),
      cancel: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
      get: vi.fn().mockResolvedValue({
        id: "provider-job-1",
        status: "SUCCESS",
        total_requests: 1,
        completed_requests: 1,
        succeeded_requests: 1,
        failed_requests: 0,
        outputs: [{ custom_id: "input-1", response: { status_code: 200, body: {} } }],
      }),
    };

    createServiceContext.mockReturnValue(context);
    getOutput.mockResolvedValue(batchOutput);
    const handler = new OcrBatchPollingHandler({ batchClient });

    await expect(
      handler.handle(
        {
          taskId: "ocr-batch:batch-output-1:2",
          task_type: OCR_BATCH_POLLING_TASK_TYPE,
          user_id: 42,
          project_id: "project-1",
          priority: 5,
          task_data: {
            outputId: "batch-output-1",
            jobId: "provider-job-1",
            userId: 42,
            projectId: "project-1",
            model: "mistral-ocr-latest",
            startedAt: new Date().toISOString(),
            pollAttempt: 2,
          },
        },
        {} as never,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("terminalises and cleans up an oversized provider result without retrying", async () => {
    const context = {
      env: {},
      repositories: {
        tasks: {},
        outputs: {
          attachSources: vi.fn(),
          getOutputIncludingDeleting: vi.fn(),
        },
      },
    };
    const batchOutput = {
      id: "batch-output-1",
      createdByUserId: 42,
      capabilityId: "ocr",
      kind: "ocr_batch",
      title: "Archive OCR",
      status: "pending",
      revision: 3,
      projectId: "project-1",
      conversationId: null,
      content: {
        batchStatus: "persisting",
        providerJobId: "provider-job-1",
        inputs: [],
      },
    };
    const terminalOutput = {
      ...batchOutput,
      status: "failed",
      revision: 4,
      content: {
        ...batchOutput.content,
        batchStatus: "failed",
        providerCleanup: {
          jobId: "provider-job-1",
          outputFileId: "provider-output-1",
        },
      },
    };
    const batchClient = {
      start: vi.fn(),
      cancel: vi.fn(),
      downloadFile: vi.fn().mockRejectedValue(new ResponseBodyTooLargeError(20 * 1024 * 1024)),
      deleteJob: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        id: "provider-job-1",
        status: "SUCCESS",
        total_requests: 1,
        completed_requests: 1,
        succeeded_requests: 1,
        failed_requests: 0,
        output_file: "provider-output-1",
      }),
    };

    createServiceContext.mockReturnValue(context);
    getOutput.mockResolvedValue(batchOutput);
    updateOutput
      .mockResolvedValueOnce(terminalOutput)
      .mockResolvedValueOnce({ ...terminalOutput, revision: 5 });
    const handler = new OcrBatchPollingHandler({ batchClient });
    const result = await handler.handle(
      {
        taskId: "ocr-batch:batch-output-1:2",
        task_type: OCR_BATCH_POLLING_TASK_TYPE,
        user_id: 42,
        project_id: "project-1",
        priority: 5,
        task_data: {
          outputId: "batch-output-1",
          jobId: "provider-job-1",
          userId: 42,
          projectId: "project-1",
          model: "mistral-ocr-latest",
          startedAt: new Date().toISOString(),
          pollAttempt: 2,
        },
      },
      {} as never,
    );

    expect(result).toMatchObject({ status: "success", message: "OCR batch result was too large" });
    expect(updateOutput).toHaveBeenNthCalledWith(
      1,
      context,
      42,
      batchOutput.id,
      expect.objectContaining({
        status: "failed",
        content: expect.objectContaining({
          error: "OCR batch result exceeded the 20 MiB ingestion limit",
        }),
      }),
    );
    expect(batchClient.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "provider-output-1" }),
    );
    expect(batchClient.deleteJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "provider-job-1" }),
    );
    expect(enqueueTask).not.toHaveBeenCalled();
  });
});
