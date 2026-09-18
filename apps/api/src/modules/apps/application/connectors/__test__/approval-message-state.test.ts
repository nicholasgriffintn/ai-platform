import { describe, expect, it, vi } from "vitest";

import { hydrateConnectorApprovalMessageState } from "../approval-message-state";

const pendingMessage = {
  id: "message-1",
  role: "tool" as const,
  name: "use_recipe_connector",
  status: "pending",
  content: "Approval required",
  data: {
    approvalRequired: true,
    approvalId: "coa_action",
    provider: "googleslides",
    operation: "GOOGLESLIDES_CREATE_SLIDES_MARKDOWN",
    expiresAt: "2099-01-01T00:00:00.000Z",
    humanInTheLoop: {
      type: "approval",
      status: "pending",
      requires_user_action: true,
    },
  },
};

describe("hydrateConnectorApprovalMessageState", () => {
  it("projects an approved receipt into the stored approval message", async () => {
    const getByIdsForUser = vi.fn().mockResolvedValue([
      {
        id: "coa_action",
        state: "approved",
        expiresAt: "2099-01-01T00:00:00.000Z",
        resolvedAt: "2026-08-13T14:00:00.000Z",
        consumedAt: null,
      },
    ]);

    const result = await hydrateConnectorApprovalMessageState({
      messages: [pendingMessage],
      userId: 42,
      approvals: { getByIdsForUser },
      now: "2026-08-13T14:01:00.000Z",
    });

    expect(getByIdsForUser).toHaveBeenCalledWith(["coa_action"], 42);
    expect(result[0]?.data?.humanInTheLoop).toEqual({
      type: "approval",
      status: "approved",
      requires_user_action: false,
      resolvedAt: "2026-08-13T14:00:00.000Z",
    });
  });

  it("reports consumed, rejected, and expired receipts without mutating unrelated messages", async () => {
    const messages = [
      pendingMessage,
      {
        ...pendingMessage,
        id: "message-2",
        data: { ...pendingMessage.data, approvalId: "coa_rejected" },
      },
      {
        ...pendingMessage,
        id: "message-3",
        data: { ...pendingMessage.data, approvalId: "coa_expired" },
      },
      { id: "message-4", role: "assistant" as const, content: "Done" },
    ];
    const getByIdsForUser = vi.fn().mockResolvedValue([
      {
        id: "coa_action",
        state: "consumed",
        expiresAt: "2099-01-01T00:00:00.000Z",
        resolvedAt: "2026-08-13T14:00:00.000Z",
        consumedAt: "2026-08-13T14:00:05.000Z",
      },
      {
        id: "coa_rejected",
        state: "rejected",
        expiresAt: "2099-01-01T00:00:00.000Z",
        resolvedAt: "2026-08-13T14:00:00.000Z",
        consumedAt: null,
      },
      {
        id: "coa_expired",
        state: "pending",
        expiresAt: "2026-08-13T13:00:00.000Z",
        resolvedAt: null,
        consumedAt: null,
      },
    ]);

    const result = await hydrateConnectorApprovalMessageState({
      messages,
      userId: 42,
      approvals: { getByIdsForUser },
      now: "2026-08-13T14:01:00.000Z",
    });

    expect(result.map((message) => message.data?.humanInTheLoop?.status)).toEqual([
      "consumed",
      "rejected",
      "expired",
      undefined,
    ]);
    expect(result[3]).toBe(messages[3]);
  });

  it("leaves messages unchanged when their receipt is unavailable to the current user", async () => {
    const result = await hydrateConnectorApprovalMessageState({
      messages: [pendingMessage],
      userId: 42,
      approvals: { getByIdsForUser: vi.fn().mockResolvedValue([]) },
      now: "2026-08-13T14:01:00.000Z",
    });

    expect(result[0]).toBe(pendingMessage);
  });

  it("reports an approved but unconsumed receipt as expired after its execution window", async () => {
    const result = await hydrateConnectorApprovalMessageState({
      messages: [pendingMessage],
      userId: 42,
      approvals: {
        getByIdsForUser: vi.fn().mockResolvedValue([
          {
            id: "coa_action",
            state: "approved",
            expiresAt: "2026-08-13T14:00:00.000Z",
            resolvedAt: "2026-08-13T13:59:00.000Z",
            consumedAt: null,
          },
        ]),
      },
      now: "2026-08-13T14:01:00.000Z",
    });

    expect(result[0]?.data?.humanInTheLoop).toMatchObject({
      status: "expired",
      requires_user_action: false,
    });
  });
});
