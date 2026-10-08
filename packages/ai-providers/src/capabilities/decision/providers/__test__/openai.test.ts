import type { DecisionQuestions, OpenAIDecisionAnswer } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestHost } from "../../../../__test__/test-runtime.js";
import { createProviderLibrary } from "../../../../create-library.js";
import { createCatalogueModelResolver } from "../../../../model-resolver.js";

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

  it("translates all question types and retains the original rubric and usage", async () => {
    const result = await provider.decide({ state: { message: "Checkout is down" }, questions });

    expect(fetchAIResponse).toHaveBeenCalledWith(
      false,
      "openai",
      "https://api.openai.com/v1/decisions",
      { Authorization: "Bearer platform-key", "Content-Type": "application/json" },
      {
        model: "gpt-6-luna",
        input: '{"message":"Checkout is down"}',
        questions: [
          {
            type: "predicate",
            name: "urgent",
            instructions: "Is this urgent?\nTrue: Immediate action\nFalse: Can wait",
          },
          {
            type: "choice",
            name: "team",
            instructions: "task: Choose the team",
            choices: [
              { value: "billing", description: "Payments" },
              { value: "technical", description: "Outages" },
            ],
          },
          {
            type: "score",
            name: "severity",
            instructions: "How severe?",
            levels: [
              { label: "0", description: "Minor" },
              { label: "1", description: "label: Major, description: Service unavailable" },
            ],
          },
        ],
      },
      { OPENAI_API_KEY: "platform-key" },
      expect.objectContaining({ includeErrorBodyInLogs: false, timeoutIncludesBody: true }),
    );
    expect(result).toEqual({
      provider: "openai",
      model: "gpt-6-luna",
      answers: {
        urgent: { type: "noul", noul: 0.97 },
        team: {
          type: "choice",
          choice: "technical",
          confidence: 0.8,
          probabilities: { billing: 0.1, technical: 0.9 },
        },
        severity: {
          type: "score",
          score: 0.8,
          confidence: 0.6,
          probabilities: { "0": 0.2, "1": 0.8 },
          legend: { "0": "Minor", "1": questions.severity.criteria[1] },
        },
      },
      usage: { input_tokens: 120, output_tokens: 0 },
    });
  });

  it("uses the user's existing OpenAI key and preserves plain text and explicit models", async () => {
    const getProviderApiKey = vi.fn(async () => "user-key");
    const userLibrary = createProviderLibrary({
      host: createTestHost({
        keyStore: () => ({ hasProviderApiKey: async () => true, getProviderApiKey }),
      }),
    });
    const userProvider = userLibrary.resolve("decision", "openai", {
      env: { OPENAI_API_KEY: "platform-key" },
      user: { id: 7 },
    });

    await userProvider.decide({ state: "Checkout is down", model: "custom-model", questions });

    expect(getProviderApiKey).toHaveBeenCalledWith(7, "openai");
    expect(fetchAIResponse).toHaveBeenCalledWith(
      false,
      "openai",
      "https://api.openai.com/v1/decisions",
      expect.objectContaining({ Authorization: "Bearer user-key" }),
      expect.objectContaining({ input: "Checkout is down", model: "custom-model" }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("rejects missing credentials before inference", async () => {
    const unconfigured = library.resolve("decision", "openai", { env: {} });

    await expect(unconfigured.decide({ state: "x", questions })).rejects.toMatchObject({
      code: "credential_missing",
    });
    expect(fetchAIResponse).not.toHaveBeenCalled();
  });

  it("does not fall back to the platform key when a stored key is unavailable", async () => {
    const userLibrary = createProviderLibrary({
      host: createTestHost({
        keyStore: () => ({
          hasProviderApiKey: async () => true,
          getProviderApiKey: async () => null,
        }),
      }),
    });
    const userProvider = userLibrary.resolve("decision", "openai", {
      env: { OPENAI_API_KEY: "platform-key" },
      user: { id: 7 },
    });

    await expect(userProvider.decide({ state: "x", questions })).rejects.toMatchObject({
      code: "credential_unavailable",
    });
    expect(fetchAIResponse).not.toHaveBeenCalled();
  });

  it("rejects invalid questions before inference", async () => {
    await expect(provider.decide({ state: "x", questions: {} })).rejects.toMatchObject({
      type: "PARAMS_ERROR",
      statusCode: 400,
    });
    expect(fetchAIResponse).not.toHaveBeenCalled();
  });

  it("surfaces a refusal without inventing a decision", async () => {
    fetchAIResponse.mockResolvedValue({
      ...response,
      answers: [{ type: "refusal", name: "urgent" }, ...answers.slice(1)],
    });

    await expect(provider.decide({ state: "x", questions })).rejects.toMatchObject({
      message: "OpenAI refused a decision question",
      type: "PROVIDER_ERROR",
      statusCode: 422,
    });
  });

  it.each([
    [],
    [answers[0], answers[0], answers[2]],
    [{ type: "predicate", name: null, probability: 0.5 }, ...answers.slice(1)],
    [{ type: "predicate", name: "urgent", probability: 2 }, ...answers.slice(1)],
    [answers[0], { ...answers[1], choice: "unknown" }, answers[2]],
    [answers[0], { ...answers[1], choice: true }, answers[2]],
    [
      answers[0],
      {
        ...answers[1],
        probabilities: [
          { value: "billing", probability: 0.1 },
          { value: "billing", probability: 0.9 },
        ],
      },
      answers[2],
    ],
    [answers[0], answers[1], { ...answers[2], score: 2 }],
    [
      answers[0],
      answers[1],
      {
        ...answers[2],
        probabilities: [
          { value: 0, label: "0", probability: 0.8 },
          { value: 1, label: "1", probability: 0.8 },
        ],
      },
    ],
    [
      answers[0],
      answers[1],
      {
        ...answers[2],
        probabilities: [
          { value: 0, label: "1", probability: 0.2 },
          { value: 1, label: "0", probability: 0.8 },
        ],
      },
    ],
  ])("rejects missing, misidentified or invalid answers (%#)", async (...invalidAnswers) => {
    fetchAIResponse.mockResolvedValue({ ...response, answers: invalidAnswers });

    await expect(provider.decide({ state: "x", questions })).rejects.toMatchObject({
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
  });

  it("selects OpenAI with existing credentials while preserving the earlier providers' priority", async () => {
    const models = createCatalogueModelResolver();

    await expect(models.getAuxiliaryDecisionModel({ OPENAI_API_KEY: "key" })).resolves.toEqual({
      model: "gpt-6-luna",
      provider: "openai",
    });
    await expect(
      models.getAuxiliaryDecisionModel({ OPENAI_API_KEY: "key", TYPESAFE_API_KEY: "key" }),
    ).resolves.toEqual({ model: "jev-latest", provider: "typesafe" });
    await expect(models.getAuxiliaryDecisionModel({})).resolves.toBeNull();
  });
});
