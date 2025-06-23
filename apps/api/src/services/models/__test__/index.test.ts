import {
  type MockedFunction,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getModelDetails,
  listCapabilities,
  listModelTypes,
  listModels,
  listModelsByCapability,
  listModelsByType,
} from "../index";

vi.mock("~/lib/models", () => ({
  getModels: vi.fn(),
  filterModelsForUserAccess: vi.fn(),
  getModelsByCapability: vi.fn(),
  getModelsByType: vi.fn(),
  getModelConfig: vi.fn(),
  availableCapabilities: ["chat", "completion", "embedding"],
  availableModelTypes: ["gpt", "claude", "gemini"],
}));

describe("Models Service", () => {
  let mockGetModels: MockedFunction<any>;
  let mockFilterModelsForUserAccess: MockedFunction<any>;
  let mockGetModelsByCapability: MockedFunction<any>;
  let mockGetModelsByType: MockedFunction<any>;
  let mockGetModelConfig: MockedFunction<any>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const modelsLib = await import("~/lib/models");
    mockGetModels = vi.mocked(modelsLib.getModels);
    mockFilterModelsForUserAccess = vi.mocked(
      modelsLib.filterModelsForUserAccess,
    );
    mockGetModelsByCapability = vi.mocked(modelsLib.getModelsByCapability);
    mockGetModelsByType = vi.mocked(modelsLib.getModelsByType);
    mockGetModelConfig = vi.mocked(modelsLib.getModelConfig);
  });

  describe("listModels", () => {
    it("should return filtered models for user", async () => {
      const mockModels = {
        "gpt-4": { id: "gpt-4" },
        "claude-3": { id: "claude-3" },
      };
      const mockFilteredModels = { "gpt-4": { id: "gpt-4" } };

      mockGetModels.mockReturnValue(mockModels);
      mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

      const result = await listModels({} as any, 123);

      expect(mockGetModels).toHaveBeenCalledOnce();
      expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
        mockModels,
        {},
        123,
      );
      expect(result).toEqual(mockFilteredModels);
    });

    it("should work without userId", async () => {
      const mockModels = { "gpt-4": { id: "gpt-4" } };

      mockGetModels.mockReturnValue(mockModels);
      mockFilterModelsForUserAccess.mockResolvedValue(mockModels);

      const result = await listModels({} as any);

      expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
        mockModels,
        {},
        undefined,
      );
      expect(result).toEqual(mockModels);
    });
  });

  describe("listCapabilities", () => {
    it("should return available capabilities", () => {
      const result = listCapabilities();

      expect(result).toEqual(["chat", "completion", "embedding"]);
    });
  });

  describe("listModelsByCapability", () => {
    it("should return filtered models by capability", async () => {
      const mockModels = { "gpt-4": { id: "gpt-4" } };
      const mockFilteredModels = { "gpt-4": { id: "gpt-4" } };

      mockGetModelsByCapability.mockReturnValue(mockModels);
      mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

      const result = await listModelsByCapability({} as any, "chat", 123);

      expect(mockGetModelsByCapability).toHaveBeenCalledWith("chat");
      expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
        mockModels,
        {},
        123,
      );
      expect(result).toEqual(mockFilteredModels);
    });
  });

  describe("listModelTypes", () => {
    it("should return available model types", () => {
      const result = listModelTypes();

      expect(result).toEqual(["gpt", "claude", "gemini"]);
    });
  });

  describe("listModelsByType", () => {
    it("should return filtered models by type", async () => {
      const mockModels = { "gpt-4": { id: "gpt-4" } };
      const mockFilteredModels = { "gpt-4": { id: "gpt-4" } };

      mockGetModelsByType.mockReturnValue(mockModels);
      mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

      const result = await listModelsByType({} as any, "gpt", 123);

      expect(mockGetModelsByType).toHaveBeenCalledWith("gpt");
      expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
        mockModels,
        {},
        123,
      );
      expect(result).toEqual(mockFilteredModels);
    });
  });

  describe("getModelDetails", () => {
    it("should return model details for accessible model", async () => {
      const mockModel = { id: "gpt-4", name: "GPT-4" };
      const mockAccessibleModels = { "gpt-4": mockModel };

      mockGetModelConfig.mockResolvedValue(mockModel);
      mockFilterModelsForUserAccess.mockResolvedValue(mockAccessibleModels);

      const result = await getModelDetails({} as any, "gpt-4", 123);

      expect(mockGetModelConfig).toHaveBeenCalledWith("gpt-4");
      expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
        { "gpt-4": mockModel },
        {},
        123,
      );
      expect(result).toEqual(mockModel);
    });

    it("should throw error for inaccessible model", async () => {
      const mockModel = { id: "gpt-4", name: "GPT-4" };
      const mockAccessibleModels = {};

      mockGetModelConfig.mockResolvedValue(mockModel);
      mockFilterModelsForUserAccess.mockResolvedValue(mockAccessibleModels);

      await expect(getModelDetails({} as any, "gpt-4", 123)).rejects.toThrow(
        "Model not found or user does not have access",
      );
    });
  });
});
