import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateCanvasOutputs } from "./canvas.js";

const mocks = vi.hoisted(() => ({
  fetchApiOrThrow: vi.fn(),
}));

vi.mock("./utils/headers.js", () => ({
  getHeaders: async () => ({ Authorization: "Bearer token" }),
}));

vi.mock("./fetch-wrapper.js", () => ({
  fetchApiOrThrow: mocks.fetchApiOrThrow,
}));

describe("canvas api", () => {
  beforeEach(() => {
    mocks.fetchApiOrThrow.mockReset();
  });

  it("starts a canvas job without the short default fetch timeout and reports rejected models", async () => {
    mocks.fetchApiOrThrow.mockResolvedValue(
      Response.json({
        object: "list",
        data: [],
        has_more: false,
        last_id: null,
        rejected: [{ error: "Unavailable", detail: { modelId: "gpt-image-2", modelName: "GPT" } }],
      }),
    );

    const result = await generateCanvasOutputs({
      mode: "image",
      prompt: "generate a mountain",
      modelIds: ["gpt-image-2"],
      projectId: "project-1",
    });

    expect(mocks.fetchApiOrThrow).toHaveBeenCalledWith(
      "/jobs",
      expect.objectContaining({
        method: "POST",
        timeoutMs: null,
        body: expect.objectContaining({ kind: "canvas_generation", project_id: "project-1" }),
      }),
    );
    expect(result.generations).toEqual([
      expect.objectContaining({ modelId: "gpt-image-2", status: "failed", error: "Unavailable" }),
    ]);
  });
});
