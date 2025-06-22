import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/providers/base", () => ({
  BaseProvider: class MockBaseProvider {
    name = "mock";
    supportsStreaming = true;
    validateParams(params: any) {
      if (!params.model && !params.version) {
        throw new Error("Missing model or version");
      }
    }
    getEndpoint() {
      return "test-endpoint";
    }
  },
}));

vi.mock("~/lib/models", () => ({
  getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/utils/parameters", () => ({
  createCommonParameters: vi.fn(),
}));

global.atob = vi.fn();

describe("WorkersProvider", () => {
  describe("validateParams", () => {
    it("should validate params correctly", async () => {
      const { WorkersProvider } = await import("../workers");
      const provider = new WorkersProvider();

      const validParams = {
        model: "worker-model",
        messages: [],
        env: {},
      };

      // @ts-ignore - validateParams is protected
      expect(() => provider.validateParams(validParams as any)).not.toThrow();

      const invalidParams = {
        messages: [],
        env: {},
      };

      // @ts-ignore - validateParams is protected
      expect(() => provider.validateParams(invalidParams as any)).toThrow();
    });
  });

  describe("mapParameters", () => {
    it("should handle image-to-text processing in mapParameters", async () => {
      const { getModelConfigByMatchingModel } = await import("~/lib/models");
      const { createCommonParameters } = await import("~/utils/parameters");

      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "worker-vision",
        type: ["image-to-text"],
      });

      vi.mocked(createCommonParameters).mockReturnValue({});

      (global.atob as any).mockReturnValue("binary-data");

      const { WorkersProvider } = await import("../workers");
      const provider = new WorkersProvider();

      const params = {
        model: "worker-vision",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              { type: "image_url", image_url: { url: "base64-data" } },
            ],
          },
        ],
        env: {},
      };

      const result = await provider.mapParameters(params as any);

      expect(result.prompt).toBe("What's in this image?");
      expect(result.image).toEqual([
        98, 105, 110, 97, 114, 121, 45, 100, 97, 116, 97,
      ]);
    });

    it("should combine system and user prompts in mapParameters", async () => {
      const { getModelConfigByMatchingModel } = await import("~/lib/models");
      const { createCommonParameters } = await import("~/utils/parameters");

      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "worker-vision",
        type: ["image-to-text"],
      });

      vi.mocked(createCommonParameters).mockReturnValue({});

      (global.atob as any).mockReturnValue("binary");

      const { WorkersProvider } = await import("../workers");
      const provider = new WorkersProvider();

      const params = {
        model: "worker-vision",
        messages: [
          { role: "system", content: "You analyze images" },
          {
            role: "user",
            content: [
              { type: "text", text: "What do you see?" },
              { type: "image_url", image_url: { url: "base64" } },
            ],
          },
        ],
        env: {},
      };

      const result = await provider.mapParameters(params as any);

      expect(result.prompt).toBe("You analyze images\n\nWhat do you see?");
    });
  });
});
