import type { Ai } from "@cloudflare/workers-types";
import type { DecisionQuestions } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestHost } from "../../../../__test__/test-runtime.js";
import { createProviderLibrary } from "../../../../create-library.js";

const questions = {
  urgent: { type: "noul", instructions: "Is this urgent?" },
  team: {
    type: "choice",
    instructions: "Which team?",
    criteria: { billing: "Payments", technical: "Outages" },
  },
  severity: { type: "score", instructions: "How severe?", criteria: ["Minor", "Major"] },
} satisfies DecisionQuestions;
const binding: Ai = {
  run: () => {
    throw new Error("Unexpected inference call");
  },
  aiGatewayLogId: null,
  gateway: () => {
    throw new Error("Unexpected gateway call");
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

  it("rejects invalid provider probabilities", async () => {
    run.mockResolvedValue({ answers: { urgent: { type: "noul", noul: 4 } } });
    await expect(
      provider().decide({ model: "clef-flash", state: "x", questions }),
    ).rejects.toMatchObject({
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
  });

  it("sanitises provider failures", async () => {
    run.mockRejectedValue(new Error("private request data"));
    await expect(
      provider().decide({ model: "clef-flash", state: "x", questions }),
    ).rejects.toMatchObject({
      message: "Workers AI decisions failed",
      type: "EXTERNAL_API_ERROR",
    });
  });
});
