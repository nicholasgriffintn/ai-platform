import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendRunCoordinatorEvent,
  getRunCoordinatorControl,
  updateRunCoordinatorControl,
} from "../run-coordinator";
import {
  getSandboxRunControlState,
  requestSandboxRunControlAction,
  requestSandboxRunInstruction,
} from "../runs";

vi.mock("../run-coordinator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../run-coordinator")>();

  return {
    ...actual,
    getRunCoordinatorControl: vi.fn(),
    updateRunCoordinatorControl: vi.fn(),
    appendRunCoordinatorEvent: vi.fn(),
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
  const mockUpdateRunCoordinatorControl = vi.mocked(updateRunCoordinatorControl);
  const mockAppendRunCoordinatorEvent = vi.mocked(appendRunCoordinatorEvent);

  const context = {
    env: {},
    repositories: {
      activities: {
        getActivityByGroup: mockGetActivityByGroup,
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
  describe("inspection window", () => {
    const expiresAt = "2026-02-17T12:10:00.000Z";

    function heldRun() {
      mockGetActivityByGroup.mockResolvedValue({
        id: "record-1",
        created_by_user_id: 42,
        project_id: null,
        data: buildRunData({ status: "completed" }),
      });
    }

    function heldControl(overrides: Record<string, unknown> = {}) {
      return {
        runId: "run-123",
        state: "inspection" as const,
        updatedAt: "2026-02-17T12:05:00.000Z",
        inspectionWindowSeconds: 300,
        inspectionExpiresAt: expiresAt,
        inspectionExtended: false,
        ...overrides,
      };
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-17T12:06:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("pushes the expiry out when the runner extends the window", async () => {
      heldRun();
      mockGetRunCoordinatorControl.mockResolvedValue(heldControl());
      mockUpdateRunCoordinatorControl.mockImplementation(async ({ inspectionExpiresAt }) => ({
        ...heldControl({ inspectionExtended: true }),
        inspectionExpiresAt,
      }));
      mockAppendRunCoordinatorEvent.mockResolvedValue(undefined);

      const control = await requestSandboxRunControlAction({
        context,
        userId: 42,
        runId: "run-123",
        input: {
          action: "extend_inspection",
          extensionSeconds: 60,
          expectedUpdatedAt: "2026-02-17T12:05:00.000Z",
        },
      });

      expect(mockUpdateRunCoordinatorControl).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "inspection",
          inspectionExpiresAt: "2026-02-17T12:11:00.000Z",
          inspectionExtended: true,
        }),
      );
      expect(control.inspectionExpiresAt).toBe("2026-02-17T12:11:00.000Z");
    });

    it("allows cancelling a run during its inspection window", async () => {
      heldRun();
      mockGetRunCoordinatorControl.mockResolvedValue(heldControl());
      mockUpdateRunCoordinatorControl.mockResolvedValue({
        ...heldControl(),
        state: "cancelled",
        updatedAt: "2026-02-17T12:06:00.000Z",
      });
      mockAppendRunCoordinatorEvent.mockResolvedValue(undefined);

      const control = await requestSandboxRunControlAction({
        context,
        userId: 42,
        runId: "run-123",
        input: {
          action: "cancel",
          expectedUpdatedAt: "2026-02-17T12:05:00.000Z",
        },
      });

      expect(mockUpdateRunCoordinatorControl).toHaveBeenCalledWith(
        expect.objectContaining({ state: "cancelled" }),
      );
      expect(control.state).toBe("cancelled");
    });

    it("refuses a second extension", async () => {
      heldRun();
      mockGetRunCoordinatorControl.mockResolvedValue(heldControl({ inspectionExtended: true }));

      await expect(
        requestSandboxRunControlAction({
          context,
          userId: 42,
          runId: "run-123",
          input: {
            action: "extend_inspection",
            extensionSeconds: 60,
            expectedUpdatedAt: "2026-02-17T12:05:00.000Z",
          },
        }),
      ).rejects.toThrow(/Cannot extend_inspection/);
      expect(mockUpdateRunCoordinatorControl).not.toHaveBeenCalled();
    });

    it("says the window closed rather than reporting the run status", async () => {
      heldRun();
      mockGetRunCoordinatorControl.mockResolvedValue(
        heldControl({ inspectionExpiresAt: "2026-02-17T12:05:30.000Z" }),
      );

      await expect(
        requestSandboxRunInstruction({
          context,
          userId: 42,
          runId: "run-123",
          kind: "run_command",
          command: "pnpm test",
        }),
      ).rejects.toThrow(/inspection window has closed/);
    });

    it("refuses a runner command from a project member who did not start the run", async () => {
      mockGetActivityByGroup.mockResolvedValue({
        id: "record-1",
        created_by_user_id: 7,
        project_id: "project-1",
        data: buildRunData({ status: "completed" }),
      });
      mockGetRunCoordinatorControl.mockResolvedValue(heldControl());
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
          kind: "run_command",
          command: "pnpm test",
        }),
      ).rejects.toThrow(/Only the run owner/);
    });
  });
});
