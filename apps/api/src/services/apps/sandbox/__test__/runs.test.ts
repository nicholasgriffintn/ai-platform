import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendRunCoordinatorEvent,
  getRunCoordinatorControl,
  updateRunCoordinatorControl,
} from "../run-coordinator";
import {
  cancelSandboxRunForProjectTask,
  getSandboxRunControlState,
  requestSandboxRunInstruction,
} from "../runs";

vi.mock("../run-coordinator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../run-coordinator")>();

  return {
    ...actual,
    appendRunCoordinatorEvent: vi.fn(),
    getRunCoordinatorControl: vi.fn(),
    updateRunCoordinatorControl: vi.fn(),
  };
});

function buildRunData(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    runId: "run-123",
    installationId: 11,
    repo: "owner/repo",
    task: "Implement feature",
    model: "mistral-large",
    shouldCommit: true,
    status: "running",
    startedAt: "2026-02-17T12:00:00.000Z",
    updatedAt: "2026-02-17T12:00:05.000Z",
    ...overrides,
  });
}

describe("sandbox runs service", () => {
  const mockGetActivityByGroup = vi.fn();
  const mockGetRunCoordinatorControl = vi.mocked(getRunCoordinatorControl);

  const context = {
    env: {},
    repositories: {
      activities: {
        getActivityByGroup: mockGetActivityByGroup,
        updateActivity: vi.fn(),
        compareAndSetActivity: vi.fn().mockImplementation(async (_id, _statuses, updates) => ({
          data: JSON.stringify(updates.data),
        })),
      },
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paused control state for paused runs", async () => {
    mockGetRunCoordinatorControl.mockResolvedValue(null);
    mockGetActivityByGroup.mockResolvedValue({
      id: "record-1",
      created_by_user_id: 42,
      project_id: null,
      data: buildRunData({
        status: "paused",
        pauseReason: "Paused from dashboard",
        timeoutSeconds: 1200,
      }),
    });

    const control = await getSandboxRunControlState({
      context,
      userId: 42,
      runId: "run-123",
    });

    expect(control).toMatchObject({
      runId: "run-123",
      state: "paused",
      pauseReason: "Paused from dashboard",
      timeoutSeconds: 1200,
    });
  });

  it("uses coordinator control when available", async () => {
    mockGetActivityByGroup.mockResolvedValue({
      id: "record-1",
      created_by_user_id: 42,
      project_id: null,
      data: buildRunData(),
    });
    mockGetRunCoordinatorControl.mockResolvedValue({
      runId: "run-123",
      state: "running",
      updatedAt: "2026-02-17T12:00:10.000Z",
      timeoutSeconds: 1200,
    });

    const control = await getSandboxRunControlState({
      context,
      userId: 42,
      runId: "run-123",
    });

    expect(control).toMatchObject({
      runId: "run-123",
      state: "running",
      timeoutSeconds: 1200,
    });
    expect(mockGetActivityByGroup).toHaveBeenCalled();
  });

  it("treats terminal Activity state as authoritative over stale coordinator control", async () => {
    mockGetActivityByGroup.mockResolvedValue({
      id: "record-1",
      created_by_user_id: 42,
      project_id: null,
      data: buildRunData({
        status: "cancelled",
        cancellationReason: "The project task was cancelled.",
      }),
    });
    mockGetRunCoordinatorControl.mockResolvedValue({
      runId: "run-123",
      state: "running",
      updatedAt: "2026-02-17T12:00:10.000Z",
    });

    await expect(
      getSandboxRunControlState({ context, userId: 42, runId: "run-123" }),
    ).resolves.toMatchObject({
      runId: "run-123",
      state: "cancelled",
      cancellationReason: "The project task was cancelled.",
    });
    expect(mockGetRunCoordinatorControl).not.toHaveBeenCalled();
  });

  it("allows a project member to read a collaborator's run control", async () => {
    mockGetRunCoordinatorControl.mockResolvedValue(null);
    mockGetActivityByGroup.mockResolvedValue({
      id: "record-1",
      created_by_user_id: 7,
      project_id: "project-1",
      data: buildRunData(),
    });
    const projectContext = {
      ...context,
      requireUser: vi.fn().mockReturnValue({ id: 42, plan_id: "pro" }),
      repositories: {
        ...context.repositories,
        workspaces: {
          getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue({ role: "member" }),
        },
      },
    };

    await expect(
      getSandboxRunControlState({ context: projectContext, userId: 42, runId: "run-123" }),
    ).resolves.toMatchObject({ runId: "run-123", state: "running" });
  });

  it("does not let a collaborating reader approve work under the runner's credentials", async () => {
    mockGetActivityByGroup.mockResolvedValue({
      id: "record-1",
      created_by_user_id: 7,
      project_id: "project-1",
      data: buildRunData({
        projectTaskContext: {
          dispatchTaskId: "dispatch-1",
          taskId: "task-1",
          projectId: "project-1",
          workspaceId: "workspace-1",
          runnerIdentityUserId: 7,
        },
      }),
    });
    const projectContext = {
      ...context,
      requireUser: vi.fn().mockReturnValue({ id: 42, plan_id: "pro" }),
      repositories: {
        ...context.repositories,
        workspaces: {
          getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue({ role: "member" }),
        },
      },
    };

    await expect(
      requestSandboxRunInstruction({
        context: projectContext,
        userId: 42,
        runId: "run-123",
        kind: "approval_response",
        requestId: "approval-1",
        approvalStatus: "approved",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("settles an exactly linked sandbox run when its project task is cancelled", async () => {
    mockGetActivityByGroup.mockResolvedValue({
      id: "record-1",
      created_by_user_id: 7,
      project_id: "project-1",
      data: buildRunData({
        projectTaskContext: {
          dispatchTaskId: "dispatch-1",
          taskId: "task-1",
          projectId: "project-1",
          workspaceId: "workspace-1",
          runnerIdentityUserId: 7,
        },
      }),
    });

    await cancelSandboxRunForProjectTask({
      context,
      taskId: "task-1",
      projectId: "project-1",
      sandboxRunId: "run-123",
      runnerIdentityUserId: 7,
      reason: "The project task was cancelled.",
    });

    expect(context.repositories.activities.compareAndSetActivity).toHaveBeenCalledWith(
      "record-1",
      ["queued", "running", "waiting"],
      expect.objectContaining({
        status: "cancelled",
        data: expect.objectContaining({ status: "cancelled" }),
      }),
    );
    expect(appendRunCoordinatorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-123" }),
    );
    expect(updateRunCoordinatorControl).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-123", state: "cancelled" }),
    );
  });

  it("does not publish cancellation when the run already won its terminal race", async () => {
    mockGetActivityByGroup.mockResolvedValue({
      id: "record-1",
      created_by_user_id: 7,
      project_id: "project-1",
      data: buildRunData({
        projectTaskContext: {
          dispatchTaskId: "dispatch-1",
          taskId: "task-1",
          projectId: "project-1",
          workspaceId: "workspace-1",
          runnerIdentityUserId: 7,
        },
      }),
    });
    context.repositories.activities.compareAndSetActivity.mockResolvedValueOnce(null);

    await cancelSandboxRunForProjectTask({
      context,
      taskId: "task-1",
      projectId: "project-1",
      sandboxRunId: "run-123",
      runnerIdentityUserId: 7,
      reason: "The project task was cancelled.",
    });

    expect(appendRunCoordinatorEvent).not.toHaveBeenCalled();
    expect(updateRunCoordinatorControl).not.toHaveBeenCalled();
  });

  it("keeps cancellation authoritative when coordinator publication fails", async () => {
    let storedData = buildRunData({
      projectTaskContext: {
        dispatchTaskId: "dispatch-1",
        taskId: "task-1",
        projectId: "project-1",
        workspaceId: "workspace-1",
        runnerIdentityUserId: 7,
      },
    });
    const projectContext = {
      ...context,
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      repositories: {
        ...context.repositories,
        activities: {
          ...context.repositories.activities,
          getActivityByGroup: vi.fn().mockImplementation(async () => ({
            id: "record-1",
            created_by_user_id: 7,
            project_id: "project-1",
            data: storedData,
          })),
          compareAndSetActivity: vi.fn().mockImplementation(async (_id, _statuses, updates) => {
            storedData = JSON.stringify(updates.data);

            return { data: storedData };
          }),
        },
        workspaces: {
          getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue({ role: "member" }),
        },
      },
    };

    vi.mocked(updateRunCoordinatorControl).mockRejectedValueOnce(
      new Error("Coordinator unavailable"),
    );
    mockGetRunCoordinatorControl.mockResolvedValue({
      runId: "run-123",
      state: "running",
      updatedAt: "2026-02-17T12:00:10.000Z",
    });

    await expect(
      cancelSandboxRunForProjectTask({
        context: projectContext,
        taskId: "task-1",
        projectId: "project-1",
        sandboxRunId: "run-123",
        runnerIdentityUserId: 7,
        reason: "The project task was cancelled.",
      }),
    ).rejects.toThrow("Coordinator unavailable");
    await expect(
      getSandboxRunControlState({
        context: projectContext,
        userId: 7,
        runId: "run-123",
      }),
    ).resolves.toMatchObject({
      state: "cancelled",
      cancellationReason: "The project task was cancelled.",
    });
  });
});
