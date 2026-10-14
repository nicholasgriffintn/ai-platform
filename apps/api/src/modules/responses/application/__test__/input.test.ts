import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { submitResponseInput } from "../input";

const mocks = vi.hoisted(() => ({
  requireChatRunAccess: vi.fn(),
  respondToProjectTaskQuestions: vi.fn(),
  respondToProjectTaskToolApproval: vi.fn(),
  getResponse: vi.fn(),
  createResponse: vi.fn(),
}));

vi.mock("../runs/status", () => ({ requireChatRunAccess: mocks.requireChatRunAccess }));
vi.mock("../read", () => ({ getResponse: mocks.getResponse }));
vi.mock("../create", () => ({ createResponse: mocks.createResponse }));
vi.mock("~/modules/project-tasks/application", () => ({
  respondToProjectTaskQuestions: mocks.respondToProjectTaskQuestions,
  respondToProjectTaskToolApproval: mocks.respondToProjectTaskToolApproval,
}));

const context = {} as ServiceContext;

describe("submitResponseInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResponse.mockResolvedValue({ object: "response", id: "resp-1" });
  });

  it("resumes a project task with its answers instead of starting a new turn", async () => {
    mocks.requireChatRunAccess.mockResolvedValue({
      id: "resp-1",
      conversationId: "conversation-1",
      projectId: "project-1",
      projectTaskId: "task-1",
    });

    await submitResponseInput({
      context,
      responseId: "resp-1",
      request: {
        input: [
          {
            type: "interaction_response",
            tool_name: "ask_user",
            response: { interactionId: "call-1", answers: [{ questionId: "q1", answer: "Yes" }] },
          },
        ],
      },
    });

    expect(mocks.respondToProjectTaskQuestions).toHaveBeenCalledWith(
      context,
      "project-1",
      "task-1",
      expect.objectContaining({ interactionId: "call-1" }),
    );
    expect(mocks.createResponse).not.toHaveBeenCalled();
  });

  it("resolves a project task tool approval through the same input", async () => {
    mocks.requireChatRunAccess.mockResolvedValue({
      id: "resp-1",
      conversationId: "conversation-1",
      projectId: "project-1",
      projectTaskId: "task-1",
    });

    await submitResponseInput({
      context,
      responseId: "resp-1",
      request: {
        input: [
          {
            type: "interaction_response",
            tool_name: "run_command",
            response: { interactionId: "call-2", resolution: "approved" },
          },
        ],
      },
    });

    expect(mocks.respondToProjectTaskToolApproval).toHaveBeenCalledWith(
      context,
      "project-1",
      "task-1",
      {
        interactionId: "call-2",
        resolution: "approved",
      },
    );
  });
});
