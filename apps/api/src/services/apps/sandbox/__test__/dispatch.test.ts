import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";
import { executeSandboxWorker } from "~/services/sandbox/worker";

import {
  enqueueSandboxRunDispatchTask,
  isSandboxRunDispatchMessage,
  processSandboxRunDispatch,
} from "../dispatch";
import { persistSandboxRunArtifact } from "../run-artifacts";
import { appendRunCoordinatorEvent, updateRunCoordinatorControl } from "../run-coordinator";
import { indexSandboxRunResult } from "../run-indexing";

const mockEnqueueTask = vi.fn();
const { mockProjectSandboxRunToProjectTask } = vi.hoisted(() => ({
  mockProjectSandboxRunToProjectTask: vi.fn(async () => "not_linked"),
}));

vi.mock("~/lib/context/serviceContext", () => ({
  createServiceContext: vi.fn(),
}));
vi.mock("~/services/sandbox/worker", () => ({
  executeSandboxWorker: vi.fn(),
  assertSandboxGitHubAuthority: vi.fn(),
}));
vi.mock("~/services/project-tasks/sandbox-projector", () => ({
  assertCurrentSandboxProjectTaskAuthority: vi.fn(async () => undefined),
  isSandboxProjectTaskDispatchCurrent: vi.fn(async () => true),
  projectSandboxRunToProjectTask: mockProjectSandboxRunToProjectTask,
}));
vi.mock("../run-coordinator", () => ({
  appendRunCoordinatorEvent: vi.fn(),
  updateRunCoordinatorControl: vi.fn(),
}));
vi.mock("../run-artifacts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../run-artifacts")>();

  return {
    ...actual,
    persistSandboxRunArtifact: vi.fn(async ({ run }) => run),
  };
});
vi.mock("../run-indexing", () => ({
  indexSandboxRunResult: vi.fn(async () => undefined),
}));
vi.mock("~/services/tasks/TaskService", () => ({
  TaskService: class {
    public enqueueTask = mockEnqueueTask;
  },
}));

const mockGetUserById = vi.fn();
const mockGetActivityById = vi.fn();
const mockUpdateActivity = vi.fn();
const mockCompareAndSetActivity = vi.fn();

const mockServiceContext = {
  env: {},
  repositories: {
    users: {
      getUserById: mockGetUserById,
    },
    activities: {
      getActivityById: mockGetActivityById,
      updateActivity: mockUpdateActivity,
      compareAndSetActivity: mockCompareAndSetActivity,
    },
    tasks: {},
  },
} as any;

const baseRunRecord = {
  runId: "run-123",
  installationId: 99,
  repo: "owner/repo",
  task: "Implement feature",
  model: "mistral-large",
  shouldCommit: true,
  status: "queued",
  startedAt: "2026-03-15T12:00:00.000Z",
  updatedAt: "2026-03-15T12:00:00.000Z",
  events: [],
  timeoutSeconds: 900,
  timeoutAt: "2026-03-15T12:15:00.000Z",
};

describe("sandbox dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActivityById.mockReset();
    mockCompareAndSetActivity.mockReset();
    vi.mocked(createServiceContext).mockReturnValue(mockServiceContext);
    mockGetUserById.mockResolvedValue({
      id: 42,
      email: "dev@example.com",
      name: "Dev",
    });
    const queuedRecord = {
      id: "record-1",
      created_by_user_id: 42,
      project_id: null,
      conversation_id: null,
      capability_id: "sandbox_runs",
      group_id: "run-123",
      kind: "sandbox_run",
      status: "queued",
      summary: "owner/repo: Implement feature",
      data: JSON.stringify(baseRunRecord),
      created_at: "2026-03-15T12:00:00.000Z",
      updated_at: "2026-03-15T12:00:00.000Z",
    };

    mockGetActivityById.mockResolvedValueOnce(queuedRecord).mockResolvedValue({
      ...queuedRecord,
      status: "running",
      data: JSON.stringify({ ...baseRunRecord, status: "running" }),
    });
    mockCompareAndSetActivity.mockImplementation(async (_id, _statuses, updates) => ({
      ...queuedRecord,
      status: updates.status,
      data: JSON.stringify(updates.data),
    }));
    mockEnqueueTask.mockResolvedValue("task-123");
    mockUpdateActivity.mockResolvedValue(undefined);
    vi.mocked(executeSandboxWorker).mockResolvedValue(
      Response.json({
        success: true,
        summary: "Completed",
      }),
    );
  });

  it("validates sandbox dispatch message shape", () => {
    expect(
      isSandboxRunDispatchMessage({
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-1",
        recordId: "record-1",
        userId: 1,
        payload: {
          installationId: 1,
          repo: "owner/repo",
          task: "Task",
          shouldCommit: false,
        },
      }),
    ).toBe(true);
    expect(
      isSandboxRunDispatchMessage({
        kind: "other",
        runId: "run-1",
      }),
    ).toBe(false);
  });

  it("enqueues dispatch message via shared task service", async () => {
    const taskId = await enqueueSandboxRunDispatchTask({
      context: {
        env: {
          TASK_QUEUE: { send: vi.fn() },
        },
        repositories: {
          tasks: {},
        },
      } as any,
      projectId: "project-1",
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-1",
        recordId: "record-1",
        userId: 1,
        payload: {
          installationId: 1,
          repo: "owner/repo",
          task: "Task",
          shouldCommit: false,
        },
      },
    });

    expect(taskId).toBe("task-123");
    expect(mockEnqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sandbox_run_dispatch_run-1",
        task_type: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        user_id: 1,
        project_id: "project-1",
        task_data: expect.objectContaining({
          kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
          runId: "run-1",
        }),
      }),
    );
  });

  it("rejects dispatch enqueue when TASK_QUEUE is unavailable", async () => {
    await expect(
      enqueueSandboxRunDispatchTask({
        context: {
          env: {},
          repositories: {
            tasks: {},
          },
        } as any,
        message: {
          kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
          runId: "run-1",
          recordId: "record-1",
          userId: 1,
          payload: {
            installationId: 1,
            repo: "owner/repo",
            task: "Task",
            shouldCommit: false,
          },
        },
      }),
    ).rejects.toThrow("TASK_QUEUE binding is not configured for sandbox run dispatch");
  });

  it("processes queued runs and persists completed state", async () => {
    await processSandboxRunDispatch({
      env: {} as any,
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-123",
        recordId: "record-1",
        userId: 42,
        payload: {
          installationId: 99,
          repo: "owner/repo",
          task: "Implement feature",
          model: "mistral-large",
          shouldCommit: true,
        },
      },
    });

    expect(executeSandboxWorker).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-123",
        repo: "owner/repo",
      }),
    );
    expect(mockCompareAndSetActivity).toHaveBeenCalled();
    expect(updateRunCoordinatorControl).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-123",
        state: "running",
      }),
    );
    expect(updateRunCoordinatorControl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runId: "run-123",
        state: "cancelled",
      }),
    );
    expect(appendRunCoordinatorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-123",
        event: expect.objectContaining({
          type: "run_completed",
        }),
      }),
    );
    expect(persistSandboxRunArtifact).toHaveBeenCalled();
    expect(indexSandboxRunResult).toHaveBeenCalled();
  });

  it("keeps large terminal artifacts out of coordinator storage", async () => {
    const largeDiff = "diff".repeat(1_000_000);
    const largeLogs = "logs".repeat(1_000_000);

    vi.mocked(executeSandboxWorker).mockResolvedValueOnce(
      new Response(
        `data: ${JSON.stringify({
          type: "run_completed",
          runId: "run-123",
          result: { success: true, diff: largeDiff, logs: largeLogs },
        })}\n\ndata: [DONE]\n\n`,
        { headers: { "content-type": "text/event-stream" } },
      ),
    );

    await processSandboxRunDispatch({
      env: {} as any,
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-123",
        recordId: "record-1",
        userId: 42,
        payload: {
          installationId: 99,
          repo: "owner/repo",
          task: "Implement feature",
          model: "mistral-large",
          shouldCommit: true,
        },
      },
    });

    expect(appendRunCoordinatorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          type: "run_completed",
          result: expect.not.objectContaining({ diff: expect.anything(), logs: expect.anything() }),
        }),
      }),
    );
    expect(persistSandboxRunArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        run: expect.objectContaining({
          result: expect.objectContaining({ diff: largeDiff, logs: largeLogs }),
        }),
      }),
    );
  });

  it("marks queued runs as failed when worker startup throws", async () => {
    vi.mocked(executeSandboxWorker).mockRejectedValueOnce(new Error("worker startup failed"));

    await processSandboxRunDispatch({
      env: {} as any,
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-123",
        recordId: "record-1",
        userId: 42,
        payload: {
          installationId: 99,
          repo: "owner/repo",
          task: "Implement feature",
          model: "mistral-large",
          shouldCommit: true,
        },
      },
    });

    expect(mockCompareAndSetActivity).toHaveBeenLastCalledWith(
      "record-1",
      ["running", "waiting"],
      expect.objectContaining({
        status: "failed",
        data: expect.objectContaining({
          status: "failed",
          workflowPhase: "failed",
          error: "worker startup failed",
        }),
      }),
    );
    expect(appendRunCoordinatorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-123",
        event: expect.objectContaining({
          type: "run_failed",
          error: "worker startup failed",
        }),
      }),
    );
    expect(updateRunCoordinatorControl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runId: "run-123",
        state: "cancelled",
        cancellationReason: "worker startup failed",
      }),
    );
    expect(indexSandboxRunResult).not.toHaveBeenCalled();
  });

  it("fails a running run deterministically when a delivery is recovered", async () => {
    const runningRecord = {
      id: "record-1",
      created_by_user_id: 42,
      project_id: null,
      conversation_id: null,
      capability_id: "sandbox_runs",
      group_id: "run-123",
      kind: "sandbox_run",
      status: "running",
      summary: "owner/repo: Implement feature",
      data: JSON.stringify({
        ...baseRunRecord,
        status: "running",
        processingStartedAt: "2026-03-15T12:00:01.000Z",
      }),
      created_at: baseRunRecord.startedAt,
      updated_at: "2026-03-15T12:00:01.000Z",
    };

    mockGetActivityById.mockReset().mockResolvedValue(runningRecord);
    mockCompareAndSetActivity
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async (_id, _statuses, updates) => ({
        ...runningRecord,
        status: updates.status,
        data: JSON.stringify(updates.data),
      }));

    await processSandboxRunDispatch({
      env: {} as any,
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-123",
        recordId: "record-1",
        userId: 42,
        payload: {
          installationId: 99,
          repo: "owner/repo",
          task: "Implement feature",
          model: "mistral-large",
          shouldCommit: true,
        },
      },
    });

    expect(executeSandboxWorker).not.toHaveBeenCalled();
    expect(mockCompareAndSetActivity).toHaveBeenLastCalledWith(
      "record-1",
      ["running", "waiting"],
      expect.objectContaining({
        status: "failed",
        data: expect.objectContaining({
          status: "failed",
          workflowPhase: "failed",
          error: expect.stringContaining("Recovered a previous delivery"),
        }),
      }),
    );
    expect(mockProjectSandboxRunToProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({
        run: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("fails the claimed run when the worker stream throws", async () => {
    vi.mocked(executeSandboxWorker).mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("stream read failed"));
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
    );

    await processSandboxRunDispatch({
      env: {} as any,
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-123",
        recordId: "record-1",
        userId: 42,
        payload: {
          installationId: 99,
          repo: "owner/repo",
          task: "Implement feature",
          model: "mistral-large",
          shouldCommit: true,
        },
      },
    });

    expect(mockCompareAndSetActivity).toHaveBeenLastCalledWith(
      "record-1",
      ["running", "waiting"],
      expect.objectContaining({
        status: "failed",
        data: expect.objectContaining({
          error: expect.stringContaining("stream read failed"),
        }),
      }),
    );
    expect(mockProjectSandboxRunToProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({ run: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("falls back to bounded terminal failure when artifact persistence throws", async () => {
    vi.mocked(persistSandboxRunArtifact).mockRejectedValueOnce(
      new Error("artifact storage unavailable"),
    );

    await processSandboxRunDispatch({
      env: {} as any,
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-123",
        recordId: "record-1",
        userId: 42,
        payload: {
          installationId: 99,
          repo: "owner/repo",
          task: "Implement feature",
          model: "mistral-large",
          shouldCommit: true,
        },
      },
    });

    expect(mockCompareAndSetActivity).toHaveBeenLastCalledWith(
      "record-1",
      ["running", "waiting"],
      expect.objectContaining({
        status: "failed",
        data: expect.objectContaining({
          result: undefined,
          error: expect.stringContaining("artifact storage unavailable"),
        }),
      }),
    );
    expect(mockProjectSandboxRunToProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({ run: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("recovers when final activity persistence throws", async () => {
    const defaultImplementation = mockCompareAndSetActivity.getMockImplementation();

    mockCompareAndSetActivity
      .mockImplementationOnce(defaultImplementation)
      .mockRejectedValueOnce(new Error("activity write interrupted"))
      .mockImplementationOnce(defaultImplementation);

    await processSandboxRunDispatch({
      env: {} as any,
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-123",
        recordId: "record-1",
        userId: 42,
        payload: {
          installationId: 99,
          repo: "owner/repo",
          task: "Implement feature",
          model: "mistral-large",
          shouldCommit: true,
        },
      },
    });

    expect(mockCompareAndSetActivity).toHaveBeenCalledTimes(3);
    expect(mockCompareAndSetActivity).toHaveBeenLastCalledWith(
      "record-1",
      ["running", "waiting"],
      expect.objectContaining({
        status: "failed",
        data: expect.objectContaining({
          error: expect.stringContaining("activity write interrupted"),
        }),
      }),
    );
    expect(mockProjectSandboxRunToProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({ run: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("does not overwrite cancellation with a worker's final result", async () => {
    const cancelledRun = {
      ...baseRunRecord,
      status: "cancelled",
      cancellationReason: "Cancelled by user",
      completedAt: "2026-03-15T12:00:10.000Z",
    };

    mockCompareAndSetActivity
      .mockImplementationOnce(async (_id, _statuses, updates) => ({
        id: "record-1",
        created_by_user_id: 42,
        project_id: null,
        conversation_id: null,
        capability_id: "sandbox_runs",
        group_id: "run-123",
        kind: "sandbox_run",
        status: updates.status,
        summary: "owner/repo: Implement feature",
        data: JSON.stringify(updates.data),
        created_at: baseRunRecord.startedAt,
        updated_at: baseRunRecord.updatedAt,
      }))
      .mockResolvedValueOnce(null);
    mockGetActivityById
      .mockReset()
      .mockResolvedValueOnce({
        id: "record-1",
        created_by_user_id: 42,
        project_id: null,
        conversation_id: null,
        capability_id: "sandbox_runs",
        group_id: "run-123",
        kind: "sandbox_run",
        status: "queued",
        summary: "owner/repo: Implement feature",
        data: JSON.stringify(baseRunRecord),
        created_at: baseRunRecord.startedAt,
        updated_at: baseRunRecord.updatedAt,
      })
      .mockResolvedValue({
        id: "record-1",
        created_by_user_id: 42,
        project_id: null,
        conversation_id: null,
        capability_id: "sandbox_runs",
        group_id: "run-123",
        kind: "sandbox_run",
        status: "cancelled",
        summary: "owner/repo: Implement feature",
        data: JSON.stringify(cancelledRun),
        created_at: baseRunRecord.startedAt,
        updated_at: cancelledRun.completedAt,
      });

    await processSandboxRunDispatch({
      env: {} as any,
      message: {
        kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        runId: "run-123",
        recordId: "record-1",
        userId: 42,
        payload: {
          installationId: 99,
          repo: "owner/repo",
          task: "Implement feature",
          model: "mistral-large",
          shouldCommit: true,
        },
      },
    });

    expect(indexSandboxRunResult).not.toHaveBeenCalled();
    expect(mockCompareAndSetActivity).toHaveBeenCalledTimes(1);
    expect(mockCompareAndSetActivity).toHaveBeenCalledWith(
      "record-1",
      ["queued"],
      expect.objectContaining({ status: "running" }),
    );
  });
});
