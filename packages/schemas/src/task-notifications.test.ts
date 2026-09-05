import { describe, expect, it } from "vitest";

import {
  createTaskInboxItemId,
  parseTaskInboxItemId,
  registerTaskNotificationSchema,
  taskNotificationSettingsSchema,
} from "./task-notifications";

describe("task notification contracts", () => {
  it("round-trips a versioned inbox identity and rejects malformed identities", () => {
    const id = createTaskInboxItemId("task-123", 7);

    expect(id).toBe("task-123:v7");
    expect(parseTaskInboxItemId(id)).toEqual({ taskId: "task-123", taskVersion: 7 });
    expect(parseTaskInboxItemId("task-123:v0")).toBeNull();
    expect(parseTaskInboxItemId("task-123")).toBeNull();
  });

  it("keeps operating-system permission outside backend registration state", () => {
    const settings = taskNotificationSettingsSchema.parse({
      protocolVersion: 1,
      preferences: {
        enabled: true,
        decisions: true,
        failures: true,
        completions: false,
        assignments: true,
      },
      registrations: [
        {
          id: "registration-1",
          installationId: "installation-1",
          platform: "web",
          state: "failed",
          failureCode: "endpoint_expired",
          updatedAt: "2026-09-05T12:00:00.000Z",
        },
      ],
      webPushPublicKey: null,
    });

    expect(settings.registrations[0].state).toBe("failed");
    expect("permission" in settings.registrations[0]).toBe(false);
  });

  it("keeps native registration on the dedicated mobile-push contract", () => {
    expect(
      registerTaskNotificationSchema.safeParse({
        platform: "ios",
        installationId: "installation-1",
        token: "not-a-device-token",
      }).success,
    ).toBe(false);
    expect(
      registerTaskNotificationSchema.safeParse({
        platform: "web",
        installationId: "installation-1",
        subscription: {
          endpoint: "https://push.example.test/subscription",
          expirationTime: null,
          keys: { p256dh: "public-key", auth: "auth-secret" },
        },
      }).success,
    ).toBe(true);
  });
});
