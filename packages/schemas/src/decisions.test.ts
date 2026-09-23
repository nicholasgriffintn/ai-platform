import { describe, expect, it } from "vitest";

import { councilDecisionInputSchema, decisionAnswersMatchQuestions } from "./decisions";

const questions = {
  route: {
    type: "choice" as const,
    instructions: "Where should this go?",
    criteria: { billing: "Money", technical: "Product" },
  },
  quality: {
    type: "score" as const,
    instructions: "How good is it?",
    criteria: ["poor", "acceptable", "excellent"],
  },
  urgent: { type: "noul" as const, instructions: "Is this urgent?" },
};

const answers = {
  route: {
    type: "choice" as const,
    choice: "billing",
    probabilities: { billing: 0.8, technical: 0.2 },
    confidence: 0.8,
  },
  quality: {
    type: "score" as const,
    score: 1.5,
    legend: { "0": "poor", "1": "acceptable", "2": "excellent" },
    probabilities: { "0": 0.1, "1": 0.4, "2": 0.5 },
    confidence: 0.5,
  },
  urgent: { type: "noul" as const, noul: 0.9 },
};

describe("decisionAnswersMatchQuestions", () => {
  it("accepts answers bound to the requested questions", () => {
    expect(decisionAnswersMatchQuestions(questions, answers)).toBe(true);
  });

  it.each([
    ["missing answer", { ...answers, urgent: undefined }],
    ["extra answer", { ...answers, other: { type: "noul", noul: 0.5 } }],
    ["wrong type", { ...answers, urgent: answers.route }],
    ["foreign choice", { ...answers, route: { ...answers.route, choice: "sales" } }],
    [
      "choice probability keys",
      { ...answers, route: { ...answers.route, probabilities: { billing: 1 } } },
    ],
    [
      "choice probability total",
      { ...answers, route: { ...answers.route, probabilities: { billing: 0.9, technical: 0.9 } } },
    ],
    ["score range", { ...answers, quality: { ...answers.quality, score: 3 } }],
    [
      "score legend",
      {
        ...answers,
        quality: {
          ...answers.quality,
          legend: { "0": "poor", "1": "good", "2": "excellent" },
        },
      },
    ],
    [
      "score probability keys",
      { ...answers, quality: { ...answers.quality, probabilities: { "0": 0.5, "1": 0.5 } } },
    ],
  ])("rejects %s mismatches", (_name, candidate) => {
    expect(decisionAnswersMatchQuestions(questions, candidate)).toBe(false);
  });
});

describe("councilDecisionInputSchema", () => {
  it("requires stable unique option identifiers", () => {
    const parsed = councilDecisionInputSchema.safeParse({
      options: [
        { id: "build", label: "Build" },
        { id: "build", label: "Buy" },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});
