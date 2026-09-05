import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { resolveProjectTaskToolApproval } from "../approvals";
import { answerProjectTaskQuestions, getPendingProjectTaskQuestions } from "../questions";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  getInstance: vi.fn(),
  lease: {
    assertOwned: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  },
}));

vi.mock("~/lib/conversationManager", () => ({
  ConversationManager: {
    getInstance: mocks.getInstance,
  },
}));

vi.mock("~/services/conversations/coordinator/client", () => ({
  withThreadLock: vi.fn(async (_params, run) => run(mocks.lease)),
}));

const questionData = {
  interactionId: "interaction-1",
  requestedAt: "2026-08-30T12:00:00.000Z",
  questions: [
    {
      id: "tone",
      prompt: "Which tone should the launch note use?",
      options: [{ label: "Friendly", description: "Warm and conversational." }],
      allowOther: true,
    },
    {
      id: "audience",
      prompt: "Who is the audience?",
      options: [],
      allowOther: true,
    },
  ],
};

function createContext() {
  const updateMessage = vi.fn().mockResolvedValue(undefined);
  const getLatestPendingToolMessage = vi.fn().mockResolvedValue({
    id: "message-1",
    name: "ask_user",
    status: "pending",
    data: JSON.stringify(questionData),
    tool_call_id: "tool-call-1",
    timestamp: 1_777_000_000_000,
  });

  return {
    context: {
      env: {},
      database: {},
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      repositories: {
        messages: { getLatestPendingToolMessage, updateMessage },
      },
    } as unknown as ServiceContext,
    getLatestPendingToolMessage,
    updateMessage,
  };
}

const task = {
  id: "task-1",
  status: "blocked",
  blockedReason: "awaiting_input",
  conversationId: "conversation-1",
  runId: "run-1",
} as ProjectTask;

describe("project task questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInstance.mockReturnValue({ add: mocks.add });
  });

  it("reads the durable pending question set from the task conversation", async () => {
    const { context } = createContext();

    await expect(getPendingProjectTaskQuestions(context, task)).resolves.toEqual(questionData);
  });

  it("resolves the pending interaction and records the answers as a user message", async () => {
    const { context, updateMessage } = createContext();

    await answerProjectTaskQuestions({
      context,
      task,
      input: {
        interactionId: "interaction-1",
        answers: [
          { questionId: "tone", answer: "Friendly" },
          { questionId: "audience", answer: "Existing customers" },
        ],
      },
    });

    expect(updateMessage).toHaveBeenCalledWith(
      "conversation-1",
      "message-1",
      expect.objectContaining({
        status: "resolved",
        data: expect.objectContaining({ resolved: true }),
      }),
    );
    expect(mocks.add).toHaveBeenCalledWith(
      "conversation-1",
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("Who is the audience?: Existing customers"),
      }),
    );
    expect(mocks.getInstance).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", writeFence: mocks.lease }),
    );
  });

  it("refuses a partial answer set", async () => {
    const { context, updateMessage } = createContext();

    await expect(
      answerProjectTaskQuestions({
        context,
        task,
        input: {
          interactionId: "interaction-1",
          answers: [{ questionId: "tone", answer: "Friendly" }],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it("loses a simultaneous answer race before writing another response", async () => {
    const { context, getLatestPendingToolMessage, updateMessage } = createContext();

    getLatestPendingToolMessage.mockResolvedValueOnce({
      id: "message-1",
      name: "ask_user",
      status: "pending",
      data: JSON.stringify(questionData),
      tool_call_id: "tool-call-1",
      timestamp: 1_777_000_000_000,
    });
    getLatestPendingToolMessage.mockResolvedValueOnce(null);

    await expect(
      answerProjectTaskQuestions({
        context,
        task,
        input: {
          interactionId: "interaction-1",
          answers: [
            { questionId: "tone", answer: "Friendly" },
            { questionId: "audience", answer: "Existing customers" },
          ],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(updateMessage).not.toHaveBeenCalled();
    expect(mocks.add).not.toHaveBeenCalled();
  });
});

describe("project task tool approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInstance.mockReturnValue({ add: mocks.add });
  });

  it("resolves the exact pending tool approval and records the decision", async () => {
    const updateMessage = vi.fn().mockResolvedValue(undefined);
    const getLatestPendingToolMessage = vi.fn().mockResolvedValue({
      id: "approval-message-1",
      name: "use_recipe_connector",
      status: "pending",
      data: JSON.stringify({
        approvalRequired: true,
        approval: {
          interactionId: "approval-1",
          toolName: "use_recipe_connector",
          reason: "Read from the connected service",
        },
      }),
      tool_call_id: "approval-1",
      timestamp: 1_777_000_000_000,
    });
    const context = {
      env: {},
      database: {},
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      repositories: {
        messages: { getLatestPendingToolMessage, updateMessage },
      },
    } as unknown as ServiceContext;

    await expect(
      resolveProjectTaskToolApproval({
        context,
        task: {
          ...task,
          blockedReason: "awaiting_approval",
        },
        input: { interactionId: "approval-1", resolution: "approved" },
      }),
    ).resolves.toEqual({ toolName: "use_recipe_connector", resolution: "approved" });
    expect(getLatestPendingToolMessage).toHaveBeenCalledWith("conversation-1");
    expect(updateMessage).toHaveBeenCalledWith(
      "conversation-1",
      "approval-message-1",
      expect.objectContaining({ status: "resolved" }),
    );
    expect(mocks.add).toHaveBeenCalledWith(
      "conversation-1",
      expect.objectContaining({
        role: "user",
        data: expect.objectContaining({
          toolApprovalResponse: {
            interactionId: "approval-1",
            resolution: "approved",
            toolName: "use_recipe_connector",
          },
        }),
      }),
    );
    expect(mocks.getInstance).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", writeFence: mocks.lease }),
    );
  });
});
