import {
  SANDBOX_RUN_DISPATCH_TASK_TYPE,
  SANDBOX_RUNS_CAPABILITY_ID,
} from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SANDBOX_RUN_ITEM_TYPE } from "~/constants/app";
import { resolveSandboxModel } from "~/services/sandbox/worker";

import { executeSandboxRunStream } from "../execute-stream";
import {
  appendRunCoordinatorEvent,
  initRunCoordinatorControl,
  listRunCoordinatorEvents,
  updateRunCoordinatorControl,
} from "../run-coordinator";

const mockEnqueueTask = vi.fn();

vi.mock("~/services/sandbox/worker", () => ({
  resolveSandboxModel: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(() => "run-123"),
}));

vi.mock("../run-coordinator", () => ({
  appendRunCoordinatorEvent: vi.fn(),
  initRunCoordinatorControl: vi.fn(),
  listRunCoordinatorEvents: vi.fn(),
  openRunCoordinatorEventsSocket: vi.fn(async () => null),
  updateRunCoordinatorControl: vi.fn(),
}));
vi.mock("~/services/tasks/TaskService", () => ({
  TaskService: class {
    public enqueueTask = mockEnqueueTask;
  },
}));

const mockCreateActivity = vi.fn();
const mockUpdateActivity = vi.fn();
const mockListPersonalActivities = vi.fn();
const mockGetProject = vi.fn();
const mockGetWorkspace = vi.fn();
const mockGetMembership = vi.fn();

const mockContext = {
  env: {},
  requireUser: () => ({ id: 42, plan_id: "pro" }),
  repositories: {
    activities: {
      createActivity: mockCreateActivity,
      updateActivity: mockUpdateActivity,
      listRecentUserActivities: mockListPersonalActivities,
    },
    workspaces: {
      getProject: mockGetProject,
      getWorkspace: mockGetWorkspace,
      getMembership: mockGetMembership,
    },
  },
} as any;

const mockUser = { id: 42 } as any;

describe("executeSandboxRunStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateActivity.mockResolvedValue({ id: "record-1" });
    mockUpdateActivity.mockResolvedValue(undefined);
    mockListPersonalActivities.mockResolvedValue([]);
    mockGetProject.mockResolvedValue({
      id: "project-1",
      workspace_id: "workspace-1",
      coding_enabled: 1,
      coding_repository: "owner/repo",
      coding_installation_id: 99,
      coding_cache_generation: 0,
    });
    mockGetWorkspace.mockResolvedValue({ id: "workspace-1" });
    mockGetMembership.mockResolvedValue({ role: "member" });
    mockEnqueueTask.mockResolvedValue("task-123");
    mockContext.env = { TASK_QUEUE: { send: vi.fn() } };
    vi.mocked(resolveSandboxModel).mockResolvedValue("mistral-large");
    vi.mocked(listRunCoordinatorEvents).mockResolvedValue([
      {
        index: 1,
        recordedAt: "2026-03-15T12:00:00.000Z",
        event: {
          type: "run_completed",
          runId: "run-123",
          timestamp: "2026-03-15T12:00:00.000Z",
        },
      },
    ]);
  });

  it("queues sandbox runs and returns a coordinator-backed stream", async () => {
    const response = await executeSandboxRunStream({
      env: {} as any,
      context: mockContext,
      user: mockUser,
      projectId: "project-1",
      conversationId: "conversation-1",
      payload: {
        installationId: 99,
        repo: "owner/repo",
        task: "Implement feature",
        modelSettings: {
          temperature: 0.2,
          reasoning: {
            effort: "high",
          },
          verbosity: "low",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-sandbox-run-id")).toBe("run-123");
    expect(mockEnqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: SANDBOX_RUN_DISPATCH_TASK_TYPE,
        user_id: 42,
        task_data: expect.objectContaining({
          payload: expect.objectContaining({
            modelSettings: {
              temperature: 0.2,
              reasoning: {
                effort: "high",
              },
              verbosity: "low",
            },
          }),
        }),
      }),
    );
    expect(mockCreateActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByUserId: 42,
        projectId: "project-1",
        conversationId: "conversation-1",
        capabilityId: SANDBOX_RUNS_CAPABILITY_ID,
        groupId: "run-123",
        kind: SANDBOX_RUN_ITEM_TYPE,
        status: "queued",
        data: expect.objectContaining({
          status: "queued",
          workflowPhase: "queued",
        }),
      }),
    );
    expect(initRunCoordinatorControl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: "run-123",
        state: "queued",
      }),
    );
    expect(appendRunCoordinatorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-123",
        event: expect.objectContaining({
          type: "run_queued",
        }),
      }),
    );

    expect(await response.text()).toContain("run_completed");
  });

  it("marks runs as failed when dispatch cannot be queued", async () => {
    mockContext.env = {};
    const response = await executeSandboxRunStream({
      env: {} as any,
      context: mockContext,
      user: mockUser,
      payload: {
        installationId: 99,
        repo: "owner/repo",
        task: "Implement feature",
      },
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "TASK_QUEUE binding is not configured for sandbox run dispatch",
    });
    expect(mockUpdateActivity).toHaveBeenCalledWith(
      "record-1",
      expect.objectContaining({
        status: "failed",
        data: expect.objectContaining({
          status: "failed",
          workflowPhase: "failed",
        }),
      }),
    );
    expect(updateRunCoordinatorControl).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-123",
        state: "cancelled",
      }),
    );
  });

  it("streams coordinator events until terminal and advances cursor", async () => {
    vi.mocked(listRunCoordinatorEvents)
      .mockResolvedValueOnce([
        {
          index: 1,
          recordedAt: "2026-03-15T12:00:00.000Z",
          event: {
            type: "run_started",
            runId: "run-123",
            timestamp: "2026-03-15T12:00:00.000Z",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          index: 2,
          recordedAt: "2026-03-15T12:00:01.000Z",
          event: {
            type: "run_failed",
            runId: "run-123",
            error: "failed",
            timestamp: "2026-03-15T12:00:01.000Z",
          },
        },
      ]);

    const response = await executeSandboxRunStream({
      env: {} as any,
      context: mockContext,
      user: mockUser,
      payload: {
        installationId: 99,
        repo: "owner/repo",
        task: "Implement feature",
      },
    });

    const streamText = await response.text();

    expect(streamText).toContain("run_started");
    expect(streamText).toContain("run_failed");
    expect(streamText).toContain("[DONE]");
    expect(listRunCoordinatorEvents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        runId: "run-123",
        after: 0,
      }),
    );
    expect(listRunCoordinatorEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        runId: "run-123",
        after: 1,
      }),
    );
  });
});
