import type { UserQuestion } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, Message } from "~/types";

const { evaluateDecisionPolicy } = vi.hoisted(() => ({ evaluateDecisionPolicy: vi.fn() }));

vi.mock("~/infrastructure/ai", () => ({ ai: { evaluateDecisionPolicy } }));

import {
  buildQuestionTranscript,
  findQuestionAnsweredByConversation,
  QUESTION_ANSWERED_POLICY,
} from "../question-answered-judgement";

const env = {} as IEnv;

function message(role: Message["role"], content: string): Message {
  return { role, content };
}

function question(prompt: string): UserQuestion {
  return { id: "colour", prompt } as UserQuestion;
}

const history = [
  message("user", "Build me a landing page, make it green"),
  message("assistant", "Starting on that now."),
];

function policyResult(outcome: "ask" | "skip", confidence: number) {
  return {
    outcome,
    receipt: {
      policy: { key: "chat.question_answered", version: "1" },
      status: "evaluated",
      applied: true,
      recommendation: { outcome, confidence, reason: "r" },
    },
  };
}

describe("QUESTION_ANSWERED_POLICY", () => {
  it("only skips the question when the model is strongly confident it was answered", () => {
    const evaluate = (noul: number) =>
      QUESTION_ANSWERED_POLICY.evaluate({ already_answered: { type: "noul", noul } });

    expect(evaluate(0.95).outcome).toBe("skip");
    expect(evaluate(0.9).outcome).toBe("skip");
    expect(evaluate(0.89).outcome).toBe("ask");
    expect(evaluate(0.6).outcome).toBe("ask");
    expect(evaluate(0.02).outcome).toBe("ask");
  });
});

describe("buildQuestionTranscript", () => {
  it("keeps only what the person and assistant said", () => {
    expect(
      buildQuestionTranscript([
        ...history,
        message("tool", "search results"),
        message("system", "instructions"),
      ]),
    ).toEqual([
      { role: "user", text: "Build me a landing page, make it green" },
      { role: "assistant", text: "Starting on that now." },
    ]);
  });
});

describe("findQuestionAnsweredByConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not consult the decision model when there is nothing to match against", async () => {
    await expect(
      findQuestionAnsweredByConversation({
        env,
        completionId: "c1",
        history: [message("assistant", "Hello")],
        questions: [question("What colour scheme?")],
      }),
    ).resolves.toBeNull();
    expect(evaluateDecisionPolicy).not.toHaveBeenCalled();
  });

  it("reports the first question the conversation already answers", async () => {
    evaluateDecisionPolicy
      .mockResolvedValueOnce(policyResult("ask", 0.8))
      .mockResolvedValueOnce(policyResult("skip", 0.92));

    const result = await findQuestionAnsweredByConversation({
      env,
      completionId: "c1",
      history,
      questions: [question("What is the deadline?"), question("What colour scheme?")],
    });

    expect(result?.question.prompt).toBe("What colour scheme?");
    expect(evaluateDecisionPolicy).toHaveBeenCalledTimes(2);
    expect(evaluateDecisionPolicy.mock.calls[0]?.[0]).toMatchObject({
      fallback: "ask",
      state: { conversation: [{ role: "user" }, { role: "assistant" }] },
    });
  });

  it("lets the question through when no answer is found", async () => {
    evaluateDecisionPolicy.mockResolvedValue(policyResult("ask", 0.7));

    await expect(
      findQuestionAnsweredByConversation({
        env,
        completionId: "c1",
        history,
        questions: [question("What is the deadline?")],
      }),
    ).resolves.toBeNull();
  });
});
