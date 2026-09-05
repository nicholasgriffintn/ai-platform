import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { TaskNotificationDeliveryHandler } from "./delivery";

const mocks = vi.hoisted(() => ({
  getDeliveryContext: vi.fn(),
  updateDelivery: vi.fn(),
  markRegistrationFailed: vi.fn(),
}));

vi.mock("~/repositories", () => ({
  RepositoryManager: class {
    taskNotifications = mocks;
  },
}));

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    delivery: {
      id: "delivery-1",
      status: "pending",
      task_id: "task-1",
      task_version: 3,
      user_id: 7,
      category: "decisions",
      attempts: 0,
    },
    registration: {
      id: "registration-1",
      state: "registered",
      platform: "ios",
      endpoint: "device-token-secret",
      p256dh: null,
      authSecret: null,
    },
    task: {
      id: "task-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      attentionVersion: 3,
      status: "blocked",
      blockedReason: "awaiting_approval",
      assigneeUserId: null,
      createdByUserId: 7,
    },
    hasWorkspaceAccess: true,
    preferences: {
      enabled: true,
      decisions: true,
      failures: true,
      completions: true,
      assignments: true,
    },
    ...overrides,
  };
}

function message() {
  return {
    taskId: "queue-task-1",
    task_type: "task_notification_delivery" as const,
    task_data: { deliveryId: "delivery-1", sensitiveToolArguments: "rm -rf /" },
    priority: 7,
  };
}

const executionContext = {
  deliveryAttempt: 1,
  isRedelivery: false,
  lease: {
    ownerToken: "owner-1",
    expiresAt: "2026-09-05T12:05:00.000Z",
    assertOwned: vi.fn().mockResolvedValue(undefined),
  },
};

function env(overrides: Partial<IEnv>): IEnv {
  return Object.assign(Object.create(null), overrides);
}

describe("task notification delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDeliveryContext.mockResolvedValue(candidate());
    mocks.updateDelivery.mockResolvedValue(undefined);
    mocks.markRegistrationFailed.mockResolvedValue(undefined);
  });

  it("obsoletes a delivery when the authoritative task revision changed", async () => {
    mocks.getDeliveryContext.mockResolvedValue(
      candidate({ task: { ...candidate().task, attentionVersion: 4, status: "running" } }),
    );
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await new TaskNotificationDeliveryHandler().handle(
      message(),
      env({
        TASK_NOTIFICATION_PROVIDER_URL: "https://push.example.test/deliver",
        TASK_NOTIFICATION_PROVIDER_TOKEN: "provider-token",
      }),
      executionContext,
    );

    expect(result.status).toBe("skipped");
    expect(mocks.updateDelivery).toHaveBeenCalledWith("delivery-1", { status: "obsolete" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only generic copy and current identifiers to the configured provider", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "provider-message-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await new TaskNotificationDeliveryHandler().handle(
      message(),
      env({
        APP_BASE_URL: "https://polychat.app",
        TASK_NOTIFICATION_PROVIDER_URL: "https://push.example.test/deliver",
        TASK_NOTIFICATION_PROVIDER_TOKEN: "provider-token",
      }),
      executionContext,
    );
    const request = fetchMock.mock.calls[0][1];
    const body = JSON.parse(String(request?.body));

    expect(result.status).toBe("success");
    expect(request?.headers).toMatchObject({ "Idempotency-Key": "delivery-1" });
    expect(body.deliveryId).toBe("delivery-1");
    expect(body.notification).toEqual({
      title: "Polychat task update",
      body: "A task needs your decision.",
      data: {
        itemId: "task-1:v3",
        deepLink:
          "https://polychat.app/work/workspace-1/projects/project-1/tasks/task-1?notification=task-1%3Av3",
      },
    });
    expect(String(request?.body)).not.toContain("rm -rf");
    expect(mocks.updateDelivery).toHaveBeenCalledWith(
      "delivery-1",
      expect.objectContaining({ status: "delivered", providerMessageId: "provider-message-1" }),
    );
  });

  it("marks an expired endpoint recoverably without retrying sensitive destination data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 410 }));

    const result = await new TaskNotificationDeliveryHandler().handle(
      message(),
      env({
        TASK_NOTIFICATION_PROVIDER_URL: "https://push.example.test/deliver",
        TASK_NOTIFICATION_PROVIDER_TOKEN: "provider-token",
      }),
      executionContext,
    );

    expect(result.status).toBe("skipped");
    expect(mocks.markRegistrationFailed).toHaveBeenCalledWith("registration-1", "endpoint_expired");
    expect(mocks.updateDelivery).toHaveBeenCalledWith(
      "delivery-1",
      expect.objectContaining({ status: "failed", failureCode: "endpoint_expired" }),
    );
  });
});
