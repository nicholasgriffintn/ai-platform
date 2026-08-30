import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { answerProjectTaskQuestions, getPendingProjectTaskQuestions } from "../questions";

const mocks = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("~/lib/conversationManager", () => ({
  ConversationManager: {
    getInstance: vi.fn(() => ({ add: mocks.add })),
  },
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
} as ProjectTask;

describe("project task questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
