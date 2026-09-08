import { afterEach, expect, it, vi } from "vitest";

import { loadWebLLMModels } from "./web-llm-models.js";

const { engineImport } = vi.hoisted(() => ({ engineImport: vi.fn() }));

vi.mock("@mlc-ai/web-llm", () => {
  engineImport();

  return { prebuiltAppConfig: { model_list: [] } };
});
afterEach(() => vi.unstubAllGlobals());

it("lists browser models for search without importing the inference engine", async () => {
  vi.stubGlobal("window", {});
  const models = await loadWebLLMModels();

  expect(engineImport).not.toHaveBeenCalled();
  expect(Object.keys(models).length).toBeGreaterThan(0);
});
