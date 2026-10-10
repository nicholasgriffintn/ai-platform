import type { Ai } from "@cloudflare/workers-types";
import type { DecisionQuestions } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestHost } from "../../../../__test__/test-runtime.js";
import { createProviderLibrary } from "../../../../create-library.js";
import { createCatalogueModelResolver } from "../../../../model-resolver.js";

const questions = {
  urgent: { type: "noul", instructions: "Is this urgent?" },
  team: {
    type: "choice",
    instructions: "Which team?",
    criteria: { billing: "Payments", technical: "Outages" },
  },
  severity: { type: "score", instructions: "How severe?", criteria: ["Minor", "Major"] },
} satisfies DecisionQuestions;
const answers = {
  urgent: { type: "noul", noul: 0.97 },
  team: {
    type: "choice",
    choice: "technical",
    probabilities: { billing: 0.1, technical: 0.9 },
    confidence: 0.8,
  },
  severity: {
    type: "score",
    score: 0.8,
    legend: { "0": "Minor", "1": "Major" },
    probabilities: { "0": 0.2, "1": 0.8 },
    confidence: 0.6,
  },
};
const binding: Ai = {
  run: () => {
    throw new Error("Unexpected inference call");
  },
  aiGatewayLogId: null,
  gateway: () => {
    throw new Error("Unexpected gateway call");
  },
  websearch: () => {
    throw new Error("Unexpected websearch call");
  },
  aiSearch: () => {
    throw new Error("Unexpected search call");
  },
  autorag: () => {
    throw new Error("Unexpected AutoRAG call");
  },
  models: async () => [],
  toMarkdown: () => {
    throw new Error("Unexpected Markdown call");
  },
};
const run = vi.spyOn(binding, "run");
const library = createProviderLibrary({ host: createTestHost() });

function provider(alias = "workers-ai") {
  return library.resolve("decision", alias, { env: { AI: binding }, user: { id: 7 } });
}

describe("Workers AI decisions", () => {
  beforeEach(() => {
    run.mockReset();
  });

  it.each([
    ["@cf/cloudflare/clef", "clef"],
    ["@cf/cloudflare/clef-flash", "clef-flash"],
    ["clef", "clef"],
    [undefined, "clef-flash"],
  ])("routes %s to the model selector and retains usage for billing", async (model, selector) => {
    run.mockResolvedValue({ model: selector, answers, usage: { input_tokens: 120 } });
    const result = await provider("workers").decide({
      model,
      state: { message: "Checkout is down" },
      questions,
    });

    expect(run).toHaveBeenCalledWith(
      `@cf/cloudflare/${selector}`,
      { model: selector, state: { message: "Checkout is down" }, questions },
      { gateway: { id: "llm-assistant", skipCache: true } },
    );
    expect(result).toEqual({
      provider: "workers-ai",
      model: `@cf/cloudflare/${selector}`,
      answers,
      usage: { input_tokens: 120, output_tokens: 0 },
    });
  });

  it("rejects unsupported models before inference", async () => {
    await expect(
      provider().decide({ model: "@cf/qwen/qwen3.8-27b", state: "x", questions }),
    ).rejects.toMatchObject({ type: "PARAMS_ERROR" });
    expect(run).not.toHaveBeenCalled();
  });

  it.each<DecisionQuestions>([
    Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`q${index}`, questions.urgent])),
    { ["q".repeat(101)]: questions.urgent },
    { q: { type: "choice", instructions: "?", criteria: { only: "One" } } },
  ])("rejects requests outside Clef limits before inference", async (invalidQuestions) => {
    await expect(
      provider().decide({ state: "x", questions: invalidQuestions }),
    ).rejects.toMatchObject({ type: "PARAMS_ERROR" });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects invalid provider probabilities", async () => {
    run.mockResolvedValue({ answers: { urgent: { type: "noul", noul: 4 } } });
    await expect(provider().decide({ state: "x", questions })).rejects.toMatchObject({
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
  });

  it("reports missing bindings clearly", async () => {
    const noBinding = library.resolve("decision", "workers-ai", { env: {} });

    await expect(noBinding.decide({ state: "x", questions })).rejects.toMatchObject({
      type: "CONFIGURATION_ERROR",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("sanitises provider failures", async () => {
    run.mockRejectedValue(new Error("private request data"));
    await expect(provider().decide({ state: "x", questions })).rejects.toMatchObject({
      message: "Workers AI decisions failed",
      type: "EXTERNAL_API_ERROR",
    });
  });

  it("preserves Jev selection and uses Flash only with its binding", async () => {
    const models = createCatalogueModelResolver();

    await expect(
      models.getAuxiliaryDecisionModel({ TYPESAFE_API_KEY: "test", AI: binding }),
    ).resolves.toEqual({ model: "jev-latest", provider: "typesafe" });
    await expect(models.getAuxiliaryDecisionModel({ AI: binding })).resolves.toEqual({
      model: "@cf/cloudflare/clef-flash",
      provider: "workers-ai",
    });
    await expect(models.getAuxiliaryDecisionModel({})).resolves.toBeNull();
  });
});
