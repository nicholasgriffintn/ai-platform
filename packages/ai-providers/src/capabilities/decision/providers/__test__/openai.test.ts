import type { DecisionQuestions, OpenAIDecisionAnswer } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestHost } from "../../../../__test__/test-runtime.js";
import { createProviderLibrary } from "../../../../create-library.js";

const { fetchAIResponse } = vi.hoisted(() => ({ fetchAIResponse: vi.fn() }));

vi.mock("../../../../fetch.js", () => ({ fetchAIResponse }));

const questions = {
  urgent: {
    type: "noul",
    instructions: "Is this urgent?",
    criteria: { true: "Immediate action", false: "Can wait" },
  },
  team: {
    type: "choice",
    instructions: { task: "Choose the team" },
    criteria: { billing: "Payments", technical: "Outages" },
  },
  severity: {
    type: "score",
    instructions: "How severe?",
    criteria: ["Minor", { label: "Major", description: "Service unavailable" }],
  },
} satisfies DecisionQuestions;

const answers: OpenAIDecisionAnswer[] = [
  { type: "predicate", name: "urgent", probability: 0.97 },
  {
    type: "choice",
    name: "team",
    choice: "technical",
    confidence: 0.8,
    probabilities: [
      { value: "billing", probability: 0.1 },
      { value: "technical", probability: 0.9 },
    ],
  },
  {
    type: "score",
    name: "severity",
    score: 0.8,
    confidence: 0.6,
    probabilities: [
      { value: 0, label: "0", probability: 0.2 },
      { value: 1, label: "1", probability: 0.8 },
    ],
  },
];

const response = {
  model: "gpt-6-luna",
  answers,
  usage: { input_tokens: 120, output_tokens: 0 },
};
const library = createProviderLibrary({ host: createTestHost() });
const provider = library.resolve("decision", "openai", { env: { OPENAI_API_KEY: "platform-key" } });

describe("OpenAI decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAIResponse.mockResolvedValue(response);
  });

  it("surfaces a refusal without inventing a decision", async () => {
    fetchAIResponse.mockResolvedValue({
      ...response,
      answers: [{ type: "refusal", name: "urgent" }, ...answers.slice(1)],
    });

    await expect(
      provider.decide({ model: "gpt-6-luna", state: "x", questions }),
    ).rejects.toMatchObject({
      message: "OpenAI refused a decision question",
      type: "PROVIDER_ERROR",
      statusCode: 422,
    });
  });

  it.each([
    [],
    [answers[0], answers[0], answers[2]],
    [{ type: "predicate", name: "urgent", probability: 2 }, ...answers.slice(1)],
    [answers[0], { ...answers[1], choice: "unknown" }, answers[2]],
  ])("rejects missing, misidentified or invalid answers (%#)", async (...invalidAnswers) => {
    fetchAIResponse.mockResolvedValue({ ...response, answers: invalidAnswers });

    await expect(
      provider.decide({ model: "gpt-6-luna", state: "x", questions }),
    ).rejects.toMatchObject({
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
  });
});
