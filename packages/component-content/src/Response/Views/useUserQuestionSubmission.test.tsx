import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UserQuestionSet } from "./userQuestionData";
import { useUserQuestionSubmission } from "./useUserQuestionSubmission";

const questionSet: UserQuestionSet = {
  interactionId: "interaction-1",
  requestedAt: "2026-10-08T10:00:00.000Z",
  resolved: false,
  questions: [
    {
      id: "audience",
      prompt: "Who is it for?",
      options: [],
      allowOther: true,
      requestsFile: false,
    },
    { id: "data", prompt: "Share the export", options: [], allowOther: false, requestsFile: true },
  ],
};

describe("useUserQuestionSubmission", () => {
  it("sends files chosen for a question along with the answers", async () => {
    const onToolInteraction = vi.fn(async () => {});
    const file = new File(["a,b"], "export.csv", { type: "text/csv" });
    const { result } = renderHook(() => useUserQuestionSubmission(questionSet, onToolInteraction));

    await act(() => result.current.answerCurrent("The board"));
    await act(() => result.current.answerCurrent("Attached export.csv", [file]));

    expect(onToolInteraction).toHaveBeenCalledWith(
      "ask_user",
      "submitPrompt",
      expect.objectContaining({
        interactionId: "interaction-1",
        files: [file],
        answers: [
          { questionId: "audience", answer: "The board" },
          { questionId: "data", answer: "Attached export.csv" },
        ],
      }),
    );
  });
});
