import type { ChatRun, TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

import { recordTeammateApprovalOutcome } from "../earned-trust";
import "~/tools";

const NOW = Date.parse("2026-10-10T09:00:00.000Z");

const teammateContext: TeammateContext = {
  id: "teammate_context_writer",
  teammateId: "teammate_writer",
  actorUserId: 7,
  scope: { type: "project", id: "project_1" },
  homeConversationId: "teammate_home_writer",
  memoryDocumentId: "memory_writer",
  status: "active",
  autonomyLevel: "assistant",
  standingApprovals: [],
  approvalStreaks: [],
  pausedUntil: null,
  monthlyCreditCapMicros: null,
  ownerSeenAt: "2026-10-06T09:00:00.000Z",
  createdAt: "2026-10-05T09:00:00.000Z",
  updatedAt: null,
};

const run = {
  id: "run_1",
  conversationId: "recipe_task_1",
  teammateContextId: teammateContext.id,
} as ChatRun;

function harness(args: Record<string, unknown>, actor: TeammateContext = teammateContext) {
  const updateApprovalStreaks = vi.fn();
  const updateStandingApprovals = vi.fn(async () => actor);
  const markOwnerSeen = vi.fn();
  const context = {
    user: { id: 7 },
    repositories: fakeRepositories([
      [
        MessageRepository,
        {
          getLatestPendingToolMessage: async () => ({
            name: "call_api",
            tool_call_id: "call_1",
            tool_call_arguments: JSON.stringify(args),
          }),
        },
      ],
      [
        TeammateContextRepository,
        {
          getById: async () => actor,
          updateApprovalStreaks,
          updateStandingApprovals,
          markOwnerSeen,
        },
      ],
    ]),
  } as unknown as ServiceContext;

  return { context, updateApprovalStreaks, updateStandingApprovals, markOwnerSeen };
}

function resolved(response: Record<string, unknown>) {
  return { toolInteraction: { toolName: "call_api", response } };
}

describe("recordTeammateApprovalOutcome", () => {
  it("counts an approved write from a teammate's routine run towards its streak", async () => {
    const { context, updateApprovalStreaks, updateStandingApprovals, markOwnerSeen } = harness({
      url: "https://api.example.com/tickets",
      method: "POST",
    });

    await recordTeammateApprovalOutcome({
      context,
      run,
      interactionId: "call_1",
      options: resolved({ resolution: "approved" }),
      now: NOW,
    });

    expect(updateApprovalStreaks.mock.calls[0]?.[1]).toMatchObject([
      { toolName: "call_api", destination: "https://api.example.com", approvals: 1 },
    ]);
    expect(updateStandingApprovals).not.toHaveBeenCalled();
    expect(markOwnerSeen).toHaveBeenCalled();
  });

  it("keeps a standing approval only when the owner chose it for a write", async () => {
    const write = harness({ url: "https://api.example.com/tickets", method: "POST" });

    await recordTeammateApprovalOutcome({
      context: write.context,
      run,
      interactionId: "call_1",
      options: resolved({ resolution: "approved", standing: true }),
      now: NOW,
    });

    expect(write.updateStandingApprovals).toHaveBeenCalledOnce();

    const destructive = harness({ url: "https://api.example.com/tickets/1", method: "DELETE" });

    await recordTeammateApprovalOutcome({
      context: destructive.context,
      run,
      interactionId: "call_1",
      options: resolved({ resolution: "approved", standing: true }),
      now: NOW,
    });

    expect(destructive.updateApprovalStreaks).not.toHaveBeenCalled();
    expect(destructive.updateStandingApprovals).not.toHaveBeenCalled();
  });

  it("ignores a run under someone else's teammate context", async () => {
    const { context, updateApprovalStreaks, markOwnerSeen } = harness(
      { url: "https://api.example.com/tickets", method: "POST" },
      { ...teammateContext, actorUserId: 8 },
    );

    await recordTeammateApprovalOutcome({
      context,
      run,
      interactionId: "call_1",
      options: resolved({ resolution: "approved" }),
      now: NOW,
    });

    expect(updateApprovalStreaks).not.toHaveBeenCalled();
    expect(markOwnerSeen).not.toHaveBeenCalled();
  });
});
