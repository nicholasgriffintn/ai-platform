import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import type { SandboxProvider } from "~/infrastructure/providers/capabilities/sandbox";
import { providerLibrary } from "~/infrastructure/providers/library";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

import { createSandboxCredentialBrokerAccess } from "../credential-broker-grants";
import { processSandboxRunDispatch } from "../dispatch";
import { releaseSandboxRunReservation } from "../usage";

const mockEnqueueTask = vi.fn();

vi.mock("~/infrastructure/context/serviceContext", () => ({
  createServiceContext: vi.fn(),
}));
vi.mock("~/infrastructure/providers/library", () => ({
  providerLibrary: { resolve: vi.fn() },
}));
vi.mock("../credential-broker-grants", () => ({
  createSandboxCredentialBrokerAccess: vi.fn(async () => ({
    baseUrl: "https://api.polychat.app/internal/sandbox/credential_broker/run-123",
    expiresAt: "2026-09-12T12:00:00.000Z",
    grant: "test-broker-grant",
  })),
}));
vi.mock("../github-credentials", () => ({
  resolveSandboxGitHubToken: vi.fn(async () => "github-installation-token"),
}));
vi.mock("../run-coordinator", () => ({
  appendRunCoordinatorEvent: vi.fn(),
  getRunCoordinatorControl: vi.fn(),
  updateRunCoordinatorControl: vi.fn(),
}));
vi.mock("../run-artifacts", () => ({
  persistSandboxRunArtifact: vi.fn(async ({ run }) => run),
}));
vi.mock("../run-indexing", () => ({
  indexSandboxRunResult: vi.fn(async () => undefined),
}));
vi.mock("../usage", () => ({
  releaseSandboxRunReservation: vi.fn(async () => undefined),
  reserveSandboxRun: vi.fn(async () => undefined),
}));
vi.mock("~/modules/queue/application/TaskService", () => ({
  TaskService: class {
    public enqueueTask = mockEnqueueTask;
  },
}));

const mockGetUserById = vi.fn();
const mockGetActivityById = vi.fn();
const mockUpdateActivity = vi.fn();
const mockExecuteSandboxProvider = vi.fn();

const sandboxProvider: SandboxProvider = {
  name: "polychat",
  capabilities: {
    credentialBroker: true,
    environmentSetup: true,
    environmentCache: true,
    inspection: true,
    remoteDelivery: true,
    runControls: true,
  },
  execute: mockExecuteSandboxProvider,
};

const mockServiceContext = {
  env: {},
  repositories: fakeRepositories([
    [
      UserRepository,
      {
        getUserById: mockGetUserById,
      },
    ],
    [
      ActivityRepository,
      {
        getActivityById: mockGetActivityById,
        updateActivity: mockUpdateActivity,
      },
    ],
    [TaskRepository, {}],
  ]),
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
    vi.mocked(createServiceContext).mockReturnValue(mockServiceContext);
    mockGetUserById.mockResolvedValue({
      id: 42,
      email: "dev@example.com",
      name: "Dev",
    });
    mockGetActivityById.mockResolvedValue({
      data: JSON.stringify(baseRunRecord),
    });
    mockEnqueueTask.mockResolvedValue("task-123");
    mockUpdateActivity.mockResolvedValue(undefined);
    vi.mocked(providerLibrary.resolve).mockReturnValue(sandboxProvider);
    mockExecuteSandboxProvider.mockResolvedValue(
      Response.json({
        success: true,
        summary: "Completed",
      }),
    );
  });

  it("normalises task and delivery policy before granting provider access", async () => {
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
          task: "Review the authentication changes",
          taskType: "code-review",
          shouldCommit: true,
        },
      },
    });

    expect(createSandboxCredentialBrokerAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryPolicy: { mode: "leave_uncommitted" },
      }),
    );
    expect(mockExecuteSandboxProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.stringContaining("Do not modify files or create commits"),
        taskType: "code-review",
        deliveryPolicy: { mode: "leave_uncommitted" },
        shouldCommit: false,
      }),
    );
  });

  it("releases the run reservation when broker grant creation fails", async () => {
    vi.mocked(createSandboxCredentialBrokerAccess).mockRejectedValueOnce(
      new Error("broker unavailable"),
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

    expect(releaseSandboxRunReservation).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-123" }),
    );
    expect(mockUpdateActivity).toHaveBeenLastCalledWith(
      "record-1",
      expect.objectContaining({
        status: "failed",
        data: expect.objectContaining({
          status: "failed",
          error: "broker unavailable",
        }),
      }),
    );
    expect(mockExecuteSandboxProvider).not.toHaveBeenCalled();
  });
});
