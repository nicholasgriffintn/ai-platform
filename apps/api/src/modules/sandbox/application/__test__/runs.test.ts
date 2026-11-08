import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { getRunCoordinatorControl } from "../run-coordinator";
import { getSandboxRunControlState, requestSandboxRunInstruction } from "../runs";

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

  const context = {
    env: {},
    repositories: fakeRepositories([
      [
        ActivityRepository,
        {
          getActivityByGroup: mockGetActivityByGroup,
        },
      ],
    ]),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
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
      repositories: fakeRepositories([
        [ActivityRepository, { getActivityByGroup: mockGetActivityByGroup }],
        [
          WorkspaceRepository,
          {
            getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
            getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
            getMembership: vi.fn().mockResolvedValue({ role: "member" }),
          },
        ],
      ]),
    };

    await expect(
      getSandboxRunControlState({ context: projectContext, userId: 42, runId: "run-123" }),
    ).resolves.toMatchObject({ runId: "run-123", state: "running" });
  });
  describe("inspection window", () => {
    const expiresAt = "2026-02-17T12:10:00.000Z";

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
        repositories: fakeRepositories([
          [ActivityRepository, { getActivityByGroup: mockGetActivityByGroup }],
          [
            WorkspaceRepository,
            {
              getProject: vi
                .fn()
                .mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
              getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
              getMembership: vi.fn().mockResolvedValue({ role: "member" }),
            },
          ],
        ]),
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
