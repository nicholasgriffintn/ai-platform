import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationManager } from "~/modules/conversations/application/manager";
import type { IEnv, IRequest, IUser, Message } from "~/types";

const handleToolCalls = vi.fn();

vi.mock("~/modules/responses/application/engine/tools/execution", () => ({
  handleToolCalls: (...args: unknown[]) => handleToolCalls(...args),
}));

import { resolveApprovedToolInteraction } from "../approved-tool-interaction";

const arguments_ = { to: "team@example.com" };

function pendingApproval(callId: string): Message {
  return {
    id: `tool-${callId}`,
    role: "tool",
    name: "send_email",
    content: "Send the email?",
    status: "pending",
    run_id: "run-1",
    tool_call_id: callId,
    tool_call_arguments: arguments_,
    data: {
      renderer: "approval_request",
      approvalRequired: true,
      options: ["Approve", "Reject"],
      approval: { interactionId: callId, toolName: "send_email" },
    },
  };
}

const messages: Message[] = [
  {
    id: "assistant-1",
    role: "assistant",
    content: "",
    tool_calls: ["call-1", "call-2"].map((id) => ({
      id,
      type: "function",
      function: { name: "send_email", arguments: JSON.stringify(arguments_) },
    })),
  },
  pendingApproval("call-1"),
  pendingApproval("call-2"),
];

const run: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 7,
  trigger: "user",
  status: "running",
  attempt: 1,
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:00:00.000Z",
  startedAt: null,
  completedAt: null,
  terminalReason: null,
  lastMessageId: "tool-call-2",
};

function decision(callId: string, resolution: "approved" | "rejected") {
  return {
    toolName: "send_email",
    response: {
      option: resolution === "approved" ? "Approve" : "Reject",
      approvalRequired: true,
      interactionId: callId,
      resolution,
    },
  };
}

function resolve(interactions: ReturnType<typeof decision>[]) {
  const update = vi.fn();
  const request: IRequest = {
    env: {} as unknown as IEnv,
    user: { id: 7 } as unknown as IUser,
    request: {
      completion_id: "conversation-1",
      input: "",
      date: "2026-10-24",
      options:
        interactions.length > 1
          ? { toolInteraction: interactions[0], toolInteractions: interactions }
          : { toolInteraction: interactions[0] },
    },
  };

  return {
    update,
    result: resolveApprovedToolInteraction({
      conversationId: "conversation-1",
      conversationManager: { update } as unknown as ConversationManager,
      loadMessages: async () => messages,
      providerMessages: messages,
      request,
      run,
    }),
  };
}

describe("resolveApprovedToolInteraction", () => {
  beforeEach(() => {
    handleToolCalls.mockReset();
    handleToolCalls.mockImplementation(async (_id, turn: { tool_calls: { id: string }[] }) =>
      turn.tool_calls.map((call) => ({
        role: "tool",
        name: "send_email",
        content: "Sent",
        status: "success",
        tool_call_id: call.id,
      })),
    );
  });

  it("settles every approval in the run together and runs only the approved actions", async () => {
    const { result, update } = resolve([
      decision("call-1", "approved"),
      decision("call-2", "rejected"),
    ]);
    const settled = await result;

    expect(handleToolCalls).toHaveBeenCalledTimes(1);
    expect(
      handleToolCalls.mock.calls[0]?.[1].tool_calls.map((call: { id: string }) => call.id),
    ).toEqual(["call-1"]);
    expect(settled?.toolCalls.map((call) => call.id)).toEqual(["call-1", "call-2"]);
    expect(settled?.toolResults.map((message) => [message.id, message.content])).toEqual([
      ["tool-call-1", "Sent"],
      ["tool-call-2", "The user rejected the proposed action."],
    ]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("refuses a partial set so the model never resumes with approvals still open", async () => {
    await expect(resolve([decision("call-2", "approved")]).result).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(handleToolCalls).not.toHaveBeenCalled();
  });
});
