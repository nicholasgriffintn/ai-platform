import { POLY_TEAMMATE_ID, type TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { hasStandingApproval } from "~/modules/chat/application/tools/effects";

import { grantPolyStandingApproval } from "../standing-approvals";

const ensureContext = vi.hoisted(() => vi.fn());

vi.mock("~/modules/teammates/application/contexts", () => ({
  ensureActiveTeammateContext: ensureContext,
}));

const polyContext: TeammateContext = {
  id: "teammate_context_poly",
  teammateId: POLY_TEAMMATE_ID,
  actorUserId: 7,
  scope: { type: "personal", id: "7" },
  homeConversationId: "teammate_home_poly",
  memoryDocumentId: "memory_poly",
  status: "active",
  autonomyLevel: "assistant",
  standingApprovals: [],
  approvalStreaks: [],
  ownerSeenAt: "2026-10-06T09:00:00.000Z",
  createdAt: "2026-10-06T09:00:00.000Z",
  updatedAt: null,
};

function context(pending: Record<string, unknown> | null) {
  const updateStandingApprovals = vi.fn(
    async (_id: string, standingApprovals: TeammateContext["standingApprovals"]) => ({
      ...polyContext,
      standingApprovals,
    }),
  );

  return {
    updateStandingApprovals,
    context: {
      requireUser: () => ({ id: 7 }),
      repositories: {
        messages: { getLatestPendingToolMessage: async () => pending },
        teammateContexts: { updateStandingApprovals },
      },
    } as unknown as ServiceContext,
  };
}

function pendingCall(args: Record<string, unknown>, id = "call_1") {
  return { name: "call_api", tool_call_id: id, tool_call_arguments: JSON.stringify(args) };
}

describe("grantPolyStandingApproval", () => {
  beforeEach(() => ensureContext.mockResolvedValue(polyContext));

  it("keeps a write Poly is waiting on, for that tool and destination only", async () => {
    const { context: service } = context(
      pendingCall({ url: "https://api.example.com/tickets", method: "POST" }),
    );

    const home = await grantPolyStandingApproval(service, "call_1");

    expect(home.standing_approvals).toEqual([
      expect.objectContaining({ toolName: "call_api", destination: "https://api.example.com" }),
    ]);
    expect(
      hasStandingApproval({
        approvals: home.standing_approvals,
        toolName: "call_api",
        destination: "https://api.example.com",
        now: Date.now(),
      }),
    ).toBe(true);
    expect(
      hasStandingApproval({
        approvals: home.standing_approvals,
        toolName: "call_api",
        destination: "https://other.example.com",
        now: Date.now(),
      }),
    ).toBe(false);
  });

  it("refuses anything that is not a write it can place, or no longer waiting", async () => {
    await expect(
      grantPolyStandingApproval(
        context(pendingCall({ url: "https://api.example.com/tickets/1", method: "DELETE" }))
          .context,
        "call_1",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      grantPolyStandingApproval(
        context(pendingCall({ url: "https://api.example.com/tickets" }, "call_2")).context,
        "call_1",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("only applies while the dial is at assistant", async () => {
    ensureContext.mockResolvedValue({ ...polyContext, autonomyLevel: "partner" });

    await expect(
      grantPolyStandingApproval(
        context(pendingCall({ url: "https://api.example.com/tickets", method: "POST" })).context,
        "call_1",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
