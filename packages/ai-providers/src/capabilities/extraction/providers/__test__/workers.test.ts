import type { Ai } from "@cloudflare/workers-types";
import type { ExtractionFields } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestHost } from "../../../../__test__/test-runtime.js";
import { createProviderLibrary } from "../../../../create-library.js";

const fields = {
  order_id: { type: "text", instructions: "Order number" },
  amount_paid: { type: "number", decimals: 2, unit: "USD" },
  damage: { type: "list", items: "text" },
  repair_cost: { type: "estimate", min: 10, max: 5000, scale: "log", step: 1 },
} satisfies ExtractionFields;
const answers = {
  order_id: {
    type: "text",
    p_null: 3.4e-6,
    span: [10, 17],
    guess: "A-88412",
    confidence: 0.99,
    value: "A-88412",
  },
  amount_paid: { type: "number", p_null: 1.6e-5, guess: 701.1, confidence: 0.99, value: 701.1 },
  damage: { type: "list", value: ["cracked screen"], spans: [[50, 64]] },
  repair_cost: {
    type: "estimate",
    value: 180,
    median: 175,
    p10: 120,
    p90: 260,
    p_below: 0,
    p_above: 0,
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

function provider() {
  return library.resolve("extraction", "workers", { env: { AI: binding }, user: { id: 7 } });
}

describe("Workers AI extractions", () => {
  beforeEach(() => {
    run.mockReset();
  });

  it("accepts answers that carry only the type and value the published contract requires", async () => {
    const minimal = {
      order_id: { type: "text", value: null, span: null, guess: null },
      amount_paid: { type: "number", value: 701.1 },
      damage: { type: "list", value: ["cracked screen"], spans: [null] },
      repair_cost: { type: "estimate", value: 180 },
    };

    run.mockResolvedValue({ model: "clairic", answers: minimal, truncated: false, usage: {} });

    await expect(
      provider().extract({ model: "clairic", state: "x", fields }),
    ).resolves.toMatchObject({
      answers: minimal,
    });
  });

  it("rejects answers that do not match the requested fields", async () => {
    run.mockResolvedValue({
      answers: { ...answers, amount_paid: { ...answers.order_id } },
      truncated: false,
      usage: { input_tokens: 10 },
    });

    await expect(
      provider().extract({ model: "clairic", state: "x", fields }),
    ).rejects.toMatchObject({
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
  });
});
