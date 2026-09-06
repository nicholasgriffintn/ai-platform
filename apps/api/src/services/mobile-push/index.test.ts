import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { notifyMobileProjectTask } from ".";

const task: ProjectTask = {
  id: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  objective: "Approve release",
  acceptanceCriteria: [],
  expectedOutput: null,
  context: null,
  constraints: null,
  dependsOnTaskIds: [],
  requireApprovalFor: [],
  status: "review",
  source: "user",
  blockedReason: null,
  blockedDetail: null,
  stageId: null,
  runner: null,
  createdByUserId: 7,
  assigneeUserId: 8,
  runnerIdentityUserId: 8,
  conversationId: "conversation-1",
  goalId: null,
  dispatchTaskId: null,
  runId: null,
  completions: [],
  position: 1,
  tokenBudget: null,
  tokensSpent: 0,
  createdAt: "2026-09-05T11:00:00.000Z",
  updatedAt: "2026-09-05T12:00:00.000Z",
  startedAt: "2026-09-05T11:01:00.000Z",
  completedAt: null,
  attentionVersion: 4,
};

function context(decisions: boolean): ServiceContext {
  const serviceContext: ServiceContext = Object.assign(Object.create(null), {
    env: {
      APNS_KEY_ID: "key-id",
      APNS_TEAM_ID: "team-id",
      APNS_PRIVATE_KEY: "AA==",
      APNS_TOPIC: "app.polychat",
    },
    repositories: {
      workspaces: { getMembership: vi.fn().mockResolvedValue({ role: "member" }) },
      taskNotifications: {
        getPreferences: vi.fn().mockResolvedValue({
          enabled: true,
          decisions,
          failures: true,
          completions: true,
          assignments: true,
        }),
      },
      mobilePush: {
        listActiveForUser: vi.fn().mockResolvedValue([
          {
            id: "device-1",
            user_id: 8,
            token: "a".repeat(64),
            environment: "sandbox",
            app_bundle_id: "app.polychat",
            last_registered_at: "2026-09-05T12:00:00.000Z",
            invalidated_at: null,
            created_at: "2026-09-05T12:00:00.000Z",
          },
        ]),
        claimDelivery: vi.fn().mockResolvedValue(true),
        finishDelivery: vi.fn().mockResolvedValue(undefined),
        invalidateDevice: vi.fn().mockResolvedValue(undefined),
      },
    },
  });

  return serviceContext;
}

describe("mobile task notification preferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the shared task preference before sending to an authorised device", async () => {
    const subtle = {
      importKey: vi.fn().mockResolvedValue({}),
      sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
    };
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    vi.stubGlobal("crypto", { subtle });
    vi.stubGlobal("fetch", send);

    const disabled = context(false);

    await notifyMobileProjectTask({
      context: disabled,
      task,
      notificationId: "notification-disabled",
      kind: "review",
    });

    expect(disabled.repositories.mobilePush.listActiveForUser).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();

    const enabled = context(true);

    await notifyMobileProjectTask({
      context: enabled,
      task,
      notificationId: "notification-enabled",
      kind: "review",
    });

    expect(enabled.repositories.mobilePush.listActiveForUser).toHaveBeenCalledWith(8);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
