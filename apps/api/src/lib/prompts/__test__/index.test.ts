import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IBody, IUser, IUserSettings } from "~/types";

const mockGetModelConfigByMatchingModel = vi.fn();
const mockReturnStandardPrompt = vi.fn();
const mockReturnCodingPrompt = vi.fn();
const mockGetTextToImageSystemPrompt = vi.fn();
const mockEmptyPrompt = vi.fn();
const mockTrimTemplateWhitespace = vi.fn();

vi.mock("~/lib/models", () => ({
  getModelConfigByMatchingModel: mockGetModelConfigByMatchingModel,
}));

vi.mock("~/lib/prompts/standard", () => ({
  returnStandardPrompt: mockReturnStandardPrompt,
}));

vi.mock("~/lib/prompts/coding", () => ({
  returnCodingPrompt: mockReturnCodingPrompt,
}));

vi.mock("~/lib/prompts/image", () => ({
  getTextToImageSystemPrompt: mockGetTextToImageSystemPrompt,
}));

vi.mock("~/lib/prompts/utils", () => ({
  emptyPrompt: mockEmptyPrompt,
}));

vi.mock("~/utils/strings", () => ({
  trimTemplateWhitespace: mockTrimTemplateWhitespace,
}));

describe("prompts index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrimTemplateWhitespace.mockImplementation((str) => str);
  });

  describe("getSystemPrompt", () => {
    // @ts-ignore - mockRequest is not typed
    const mockRequest: IBody = { messages: [] };
    // @ts-ignore - mockUser is not typed
    const mockUser: IUser = { id: "user-1" } as IUser;
    // @ts-ignore - mockUserSettings is not typed
    const mockUserSettings: IUserSettings = {} as IUserSettings;

    it("should use standard prompt when no model config found", async () => {
      mockGetModelConfigByMatchingModel.mockResolvedValue(null);
      mockReturnStandardPrompt.mockResolvedValue("standard prompt");

      const { getSystemPrompt } = await import("../index");
      const result = await getSystemPrompt(
        mockRequest,
        "unknown-model",
        mockUser,
        mockUserSettings,
      );

      expect(mockGetModelConfigByMatchingModel).toHaveBeenCalledWith(
        "unknown-model",
      );
      expect(mockReturnStandardPrompt).toHaveBeenCalledWith(
        mockRequest,
        mockUser,
        mockUserSettings,
        false,
        false,
        false,
        false,
      );
      expect(result).toBe("standard prompt");
    });

    it("should use coding prompt for coding models", async () => {
      mockGetModelConfigByMatchingModel.mockResolvedValue({
        type: ["coding"],
        supportsToolCalls: true,
        supportsArtifacts: true,
        supportsReasoning: false,
        requiresThinkingPrompt: false,
      });
      mockReturnCodingPrompt.mockResolvedValue("coding prompt");

      const { getSystemPrompt } = await import("../index");
      const result = await getSystemPrompt(
        mockRequest,
        "coding-model",
        mockUser,
        mockUserSettings,
      );

      expect(mockReturnCodingPrompt).toHaveBeenCalledWith(
        mockRequest,
        mockUserSettings,
        true,
        true,
        false,
        false,
      );
      expect(result).toBe("coding prompt");
    });

    it("should use text-to-image prompt for image models", async () => {
      const mockImageRequest = { ...mockRequest, image_style: "cyberpunk" };
      mockGetModelConfigByMatchingModel.mockResolvedValue({
        type: ["text-to-image"],
      });
      mockGetTextToImageSystemPrompt.mockReturnValue("image prompt");

      const { getSystemPrompt } = await import("../index");
      const result = await getSystemPrompt(
        mockImageRequest,
        "image-model",
        mockUser,
        mockUserSettings,
      );

      expect(mockGetTextToImageSystemPrompt).toHaveBeenCalledWith("cyberpunk");
      expect(result).toBe("image prompt");
    });

    it("should use empty prompt for non-text, non-coding, non-image models", async () => {
      mockGetModelConfigByMatchingModel.mockResolvedValue({
        type: ["other"],
      });
      mockEmptyPrompt.mockReturnValue("");

      const { getSystemPrompt } = await import("../index");
      const result = await getSystemPrompt(
        mockRequest,
        "other-model",
        mockUser,
        mockUserSettings,
      );

      expect(mockEmptyPrompt).toHaveBeenCalled();
      expect(result).toBe("");
    });

    it("should use standard prompt for text models", async () => {
      mockGetModelConfigByMatchingModel.mockResolvedValue({
        type: ["text"],
        supportsToolCalls: false,
        supportsArtifacts: false,
        supportsReasoning: true,
        requiresThinkingPrompt: true,
      });
      mockReturnStandardPrompt.mockResolvedValue("text prompt");

      const { getSystemPrompt } = await import("../index");
      const result = await getSystemPrompt(
        mockRequest,
        "text-model",
        mockUser,
        mockUserSettings,
      );

      expect(mockReturnStandardPrompt).toHaveBeenCalledWith(
        mockRequest,
        mockUser,
        mockUserSettings,
        false,
        false,
        true,
        true,
      );
      expect(result).toBe("text prompt");
    });

    it("should prefer standard prompt for text+coding models", async () => {
      mockGetModelConfigByMatchingModel.mockResolvedValue({
        type: ["text", "coding"],
        supportsToolCalls: true,
        supportsArtifacts: true,
      });
      mockReturnStandardPrompt.mockResolvedValue("mixed prompt");

      const { getSystemPrompt } = await import("../index");
      const result = await getSystemPrompt(
        mockRequest,
        "mixed-model",
        mockUser,
        mockUserSettings,
      );

      expect(mockReturnStandardPrompt).toHaveBeenCalled();
      expect(mockReturnCodingPrompt).not.toHaveBeenCalled();
      expect(result).toBe("mixed prompt");
    });

    it("should trim whitespace from result", async () => {
      const originalPrompt = "  prompt with whitespace  ";
      const trimmedPrompt = "prompt with whitespace";

      mockGetModelConfigByMatchingModel.mockResolvedValue(null);
      mockReturnStandardPrompt.mockResolvedValue(originalPrompt);
      mockTrimTemplateWhitespace.mockReturnValue(trimmedPrompt);

      const { getSystemPrompt } = await import("../index");
      const result = await getSystemPrompt(mockRequest, "test-model");

      expect(mockTrimTemplateWhitespace).toHaveBeenCalledWith(originalPrompt);
      expect(result).toBe(trimmedPrompt);
    });
  });

  describe("template functions", () => {
    it("should generate analyse article prompt with article content", async () => {
      const { analyseArticlePrompt } = await import("../index");
      const article = "Test article content";
      const result = analyseArticlePrompt(article);

      expect(typeof result).toBe("string");
      expect(result).toContain(article);
      expect(result).toContain("comprehensive analysis");
      expect(result).toContain("Bias Detection");
      expect(result).toContain("Political Alignment");
    });

    it("should generate summarise article prompt with article content", async () => {
      const { summariseArticlePrompt } = await import("../index");
      const article = "Test article for summary";
      const result = summariseArticlePrompt(article);

      expect(typeof result).toBe("string");
      expect(result).toContain(article);
      expect(result).toContain("professional summary");
      expect(result).toContain("300-400 words");
      expect(result).toContain("Key Findings");
    });

    it("should generate article report prompt with articles content", async () => {
      const { generateArticleReportPrompt } = await import("../index");
      const articles = "Collection of article summaries";
      const result = generateArticleReportPrompt(articles);

      expect(typeof result).toBe("string");
      expect(result).toContain(articles);
      expect(result).toContain("800-1500 words");
      expect(result).toContain("Article Summaries");
    });

    it("should generate web search questions system prompt", async () => {
      const { webSearchSimilarQuestionsSystemPrompt } = await import(
        "../index"
      );
      const result = webSearchSimilarQuestionsSystemPrompt();

      expect(typeof result).toBe("string");
      expect(result).toContain("3 valuable, related topics");
      expect(result).toContain("JSON array");
      expect(result).toContain("maximum 20 words");
    });

    it("should generate web search answer prompt with contexts", async () => {
      const { webSearchAnswerSystemPrompt } = await import("../index");
      const contexts = "Context 1\nContext 2";
      const result = webSearchAnswerSystemPrompt(contexts);

      expect(typeof result).toBe("string");
      expect(result).toContain(contexts);
      expect(result).toContain("citation reference");
      expect(result).toContain("[[citation:x]]");
    });

    it("should generate extract content system prompt", async () => {
      const { extractContentsystem_prompt } = await import("../index");
      const result = extractContentsystem_prompt();

      expect(typeof result).toBe("string");
      expect(result).toContain("summarizes web content");
      expect(result).toContain("accurate, relevant information");
    });

    it("should generate drawing description prompt", async () => {
      const { drawingDescriptionPrompt } = await import("../index");
      const result = drawingDescriptionPrompt();

      expect(typeof result).toBe("string");
      expect(result).toContain("image analysis AI");
      expect(result).toContain("single, informative sentence");
      expect(result).toContain("distinguishable features");
    });

    it("should generate guess drawing prompt with used guesses", async () => {
      const { guessDrawingPrompt } = await import("../index");
      const usedGuesses = new Set(["cat", "dog"]);
      const result = guessDrawingPrompt(usedGuesses);

      expect(typeof result).toBe("string");
      expect(result).toContain("cat, dog");
      expect(result).toContain("single word response");
      expect(result).toContain(
        "Do not use any of these previously guessed words",
      );
    });

    it("should generate tutor system prompt with sources and level", async () => {
      const { tutorSystemPrompt } = await import("../index");
      const sources = "Teaching material content";
      const level = "beginner";
      const result = tutorSystemPrompt(sources, level);

      expect(typeof result).toBe("string");
      expect(result).toContain(sources);
      expect(result).toContain(level);
      expect(result).toContain("profession personal tutor");
      expect(result).toContain("quiz the user occasionally");
    });
  });
});
