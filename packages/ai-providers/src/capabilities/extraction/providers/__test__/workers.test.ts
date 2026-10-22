import type { Ai } from "@cloudflare/workers-types";
import type { ExtractionFields } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestHost } from "../../../../__test__/test-runtime.js";
import { createProviderLibrary } from "../../../../create-library.js";
import { createCatalogueModelResolver } from "../../../../model-resolver.js";
import type { ExtractionRequest } from "../../../../types/extraction.js";

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

  it("sends Clairic its selector, images and reference date, and keeps usage for billing", async () => {
    const images = ["data:image/png;base64,iVBORw=="];

    run.mockResolvedValue({
      model: "clairic",
      answers,
      truncated: false,
      usage: { input_tokens: 655, output_tokens: 0, passes: 3 },
    });
    const result = await provider().extract({
      state: "Order A-88412",
      fields,
      images,
      reference_date: "2026-10-09",
    });

    expect(run).toHaveBeenCalledWith(
      "@cf/cloudflare/clairic",
      { model: "clairic", state: "Order A-88412", fields, images, reference_date: "2026-10-09" },
      { gateway: { id: "llm-assistant", skipCache: true } },
    );
    expect(result).toEqual({
      provider: "workers-ai",
      model: "@cf/cloudflare/clairic",
      answers,
      truncated: false,
      usage: { input_tokens: 655, output_tokens: 0 },
    });
  });

  it.each<ExtractionRequest>([
    { state: "", fields },
    { state: "x", fields: {} },
    { state: "x", fields: { total: { type: "estimate", min: 10, max: 1 } } },
    { state: "x", fields, images: ["https://example.com/receipt.png"] },
  ])("rejects requests Clairic cannot read before inference", async (request) => {
    await expect(provider().extract(request)).rejects.toMatchObject({
      type: "PARAMS_ERROR",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("accepts answers that carry only the type and value the published contract requires", async () => {
    const minimal = {
      order_id: { type: "text", value: null, span: null, guess: null },
      amount_paid: { type: "number", value: 701.1 },
      damage: { type: "list", value: ["cracked screen"], spans: [null] },
      repair_cost: { type: "estimate", value: 180 },
    };

    run.mockResolvedValue({ model: "clairic", answers: minimal, truncated: false, usage: {} });

    await expect(provider().extract({ state: "x", fields })).resolves.toMatchObject({
      answers: minimal,
    });
  });

  it("rejects answers that do not match the requested fields", async () => {
    run.mockResolvedValue({
      answers: { ...answers, amount_paid: { ...answers.order_id } },
      truncated: false,
      usage: { input_tokens: 10 },
    });

    await expect(provider().extract({ state: "x", fields })).rejects.toMatchObject({
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
  });

  it("resolves Clairic as the extraction model only with the Workers AI binding", async () => {
    const models = createCatalogueModelResolver();

    await expect(models.getSystemModel({ AI: binding }, undefined, "extraction")).resolves.toEqual({
      model: "@cf/cloudflare/clairic",
      provider: "workers-ai",
    });
    await expect(models.getSystemModel({}, undefined, "extraction")).resolves.toBeNull();
  });
});
