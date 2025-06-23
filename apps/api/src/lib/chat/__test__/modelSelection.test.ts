import { beforeEach, describe, expect, it, vi } from "vitest";

const mockModelRouter = {
  selectModel: vi.fn(),
  selectMultipleModels: vi.fn(),
};

vi.mock("~/lib/modelRouter", () => ({
  ModelRouter: mockModelRouter,
}));

describe("selectModels", () => {
  let selectModels: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../modelSelection");
    selectModels = module.selectModels;
  });

  const mockEnv = {} as any;
  const mockUser = { id: "user-123" } as any;
  const mockAttachments = [];
  const lastMessageText = "Hello world";
  const completionId = "completion-123";
  const budgetConstraint = 100;

  describe("when use_multi_model is true and no requestedModel", () => {
    it("should call selectMultipleModels and return result", async () => {
      const expectedModels = ["model1", "model2"];
      mockModelRouter.selectMultipleModels.mockResolvedValue(expectedModels);

      const result = await selectModels(
        mockEnv,
        lastMessageText,
        mockAttachments,
        budgetConstraint,
        mockUser,
        completionId,
        undefined,
        true,
      );

      expect(mockModelRouter.selectMultipleModels).toHaveBeenCalledWith(
        mockEnv,
        lastMessageText,
        mockAttachments,
        budgetConstraint,
        mockUser,
        completionId,
      );
      expect(mockModelRouter.selectModel).not.toHaveBeenCalled();
      expect(result).toEqual(expectedModels);
    });
  });

  describe("when use_multi_model is true but requestedModel is provided", () => {
    it("should return the requested model in an array", async () => {
      const requestedModel = "specific-model";

      const result = await selectModels(
        mockEnv,
        lastMessageText,
        mockAttachments,
        budgetConstraint,
        mockUser,
        completionId,
        requestedModel,
        true,
      );

      expect(mockModelRouter.selectMultipleModels).not.toHaveBeenCalled();
      expect(mockModelRouter.selectModel).not.toHaveBeenCalled();
      expect(result).toEqual([requestedModel]);
    });
  });

  describe("when requestedModel is provided", () => {
    it("should return the requested model in an array", async () => {
      const requestedModel = "specific-model";

      const result = await selectModels(
        mockEnv,
        lastMessageText,
        mockAttachments,
        budgetConstraint,
        mockUser,
        completionId,
        requestedModel,
        false,
      );

      expect(mockModelRouter.selectMultipleModels).not.toHaveBeenCalled();
      expect(mockModelRouter.selectModel).not.toHaveBeenCalled();
      expect(result).toEqual([requestedModel]);
    });
  });

  describe("when no requestedModel and use_multi_model is false", () => {
    it("should call selectModel and return result in an array", async () => {
      const selectedModel = "auto-selected-model";
      mockModelRouter.selectModel.mockResolvedValue(selectedModel);

      const result = await selectModels(
        mockEnv,
        lastMessageText,
        mockAttachments,
        budgetConstraint,
        mockUser,
        completionId,
        undefined,
        false,
      );

      expect(mockModelRouter.selectModel).toHaveBeenCalledWith(
        mockEnv,
        lastMessageText,
        mockAttachments,
        budgetConstraint,
        mockUser,
        completionId,
      );
      expect(mockModelRouter.selectMultipleModels).not.toHaveBeenCalled();
      expect(result).toEqual([selectedModel]);
    });
  });

  describe("when use_multi_model is undefined", () => {
    it("should default to single model selection", async () => {
      const selectedModel = "auto-selected-model";
      mockModelRouter.selectModel.mockResolvedValue(selectedModel);

      const result = await selectModels(
        mockEnv,
        lastMessageText,
        mockAttachments,
        budgetConstraint,
        mockUser,
        completionId,
      );

      expect(mockModelRouter.selectModel).toHaveBeenCalledWith(
        mockEnv,
        lastMessageText,
        mockAttachments,
        budgetConstraint,
        mockUser,
        completionId,
      );
      expect(result).toEqual([selectedModel]);
    });
  });

  describe("with optional parameters", () => {
    it("should handle undefined budgetConstraint", async () => {
      const selectedModel = "auto-selected-model";
      mockModelRouter.selectModel.mockResolvedValue(selectedModel);

      const result = await selectModels(
        mockEnv,
        lastMessageText,
        mockAttachments,
        undefined,
        mockUser,
        completionId,
      );

      expect(mockModelRouter.selectModel).toHaveBeenCalledWith(
        mockEnv,
        lastMessageText,
        mockAttachments,
        undefined,
        mockUser,
        completionId,
      );
      expect(result).toEqual([selectedModel]);
    });

    it("should handle different attachment types", async () => {
      const attachmentsWithImage = [
        { type: "image", data: "base64data" },
      ] as any;
      const selectedModel = "vision-model";
      mockModelRouter.selectModel.mockResolvedValue(selectedModel);

      const result = await selectModels(
        mockEnv,
        "Analyze this image",
        attachmentsWithImage,
        budgetConstraint,
        mockUser,
        completionId,
      );

      expect(mockModelRouter.selectModel).toHaveBeenCalledWith(
        mockEnv,
        "Analyze this image",
        attachmentsWithImage,
        budgetConstraint,
        mockUser,
        completionId,
      );
      expect(result).toEqual([selectedModel]);
    });
  });
});
