import { describe, expect, it } from "vitest";

import type { Message } from "~/types";

import { findAnsweredQuestion } from "../userQuestionHistory";

const answeredQuestionMessage: Message = {
  role: "tool",
  name: "ask_user",
  status: "resolved",
  content: "Questions answered.",
  data: {
    interactionId: "interaction-1",
    requestedAt: "2026-08-30T10:00:00.000Z",
    questions: [
      {
        id: "approve_final_draft",
        prompt: "Does this final draft meet your expectations?",
      },
    ],
  },
};

describe("findAnsweredQuestion", () => {
  it("matches a previously answered decision by stable id", () => {
    expect(
      findAnsweredQuestion([answeredQuestionMessage], {
        id: "approve_final_draft",
        prompt: "Can I publish the final draft?",
        options: [],
        allowOther: true,
      }),
    ).toEqual(
      expect.objectContaining({
        id: "approve_final_draft",
      }),
    );
  });

  it("matches the same answered question after superficial wording changes", () => {
    expect(
      findAnsweredQuestion([answeredQuestionMessage], {
        id: "approve_final",
        prompt: "  Does this FINAL draft meet your expectations?  ",
        options: [],
        allowOther: true,
      }),
    ).toEqual(
      expect.objectContaining({
        id: "approve_final_draft",
      }),
    );
  });

  it("ignores pending and unrelated questions", () => {
    expect(
      findAnsweredQuestion(
        [
          { ...answeredQuestionMessage, status: "pending" },
          { ...answeredQuestionMessage, name: "request_approval" },
        ],
        {
          id: "approve_final_draft",
          prompt: "Does this final draft meet your expectations?",
          options: [],
          allowOther: true,
        },
      ),
    ).toBeNull();
  });
});
