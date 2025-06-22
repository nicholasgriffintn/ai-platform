import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuxiliaryGuardrailsModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import { AssistantError, ErrorType } from "~/utils/errors";
import { LlamaGuardProvider } from "../llamaguard";

vi.mock("~/lib/models");
vi.mock("~/lib/providers/factory");

const mockGetAuxiliaryGuardrailsModel = vi.mocked(getAuxiliaryGuardrailsModel);
const mockAIProviderFactory = vi.mocked(AIProviderFactory);

const mockAIProvider = {
  getResponse: vi.fn(),
};

describe("LlamaGuardProvider", () => {
  const mockConfig = {
    ai: {} as any,
    env: { AI: {} } as any,
    user: {
      id: "user-123",
      email: "test@example.com",
    } as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuxiliaryGuardrailsModel.mockResolvedValue({
      model: "llama-guard-model",
      provider: "test-provider",
    });
    // @ts-ignore - mockAIProvider is not typed
    mockAIProviderFactory.getProvider.mockReturnValue(mockAIProvider);
  });

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      const provider = new LlamaGuardProvider(mockConfig);
      expect(provider).toBeDefined();
    });
  });

  describe("validateContent", () => {
    it("should validate safe content", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "safe",
      });

      const result = await provider.validateContent(
        "Hello, how are you?",
        "INPUT",
      );

      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.rawResponse).toBe("safe");
    });

    it("should detect unsafe content", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "unsafe\nS1: Violent Crimes, S10: Hate",
      });

      const result = await provider.validateContent(
        "violent and hateful content",
        "INPUT",
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual([
        "unsafe\nS1: Violent Crimes, S10: Hate",
      ]);
      expect(result.rawResponse).toBe("unsafe\nS1: Violent Crimes, S10: Hate");
    });

    it("should properly distinguish 'unsafe' from 'safe'", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "unsafe\nS1: Violent Crimes",
      });

      const unsafeResult = await provider.validateContent(
        "violent content",
        "INPUT",
      );
      expect(unsafeResult.isValid).toBe(false);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "safe",
      });

      const safeResult = await provider.validateContent(
        "normal content",
        "INPUT",
      );
      expect(safeResult.isValid).toBe(true);
    });

    it("should handle content marked as allowed", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "allowed - content is acceptable",
      });

      const result = await provider.validateContent(
        "normal conversation",
        "OUTPUT",
      );

      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it("should validate INPUT content with correct role", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "safe",
      });

      await provider.validateContent("test input", "INPUT");

      const callArgs = mockAIProvider.getResponse.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain("user: test input");
      expect(callArgs.messages[0].content).toContain("ONLY THE LAST user");
    });

    it("should validate OUTPUT content with correct role", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "safe",
      });

      await provider.validateContent("test output", "OUTPUT");

      const callArgs = mockAIProvider.getResponse.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain("assistant: test output");
      expect(callArgs.messages[0].content).toContain("ONLY THE LAST assistant");
    });

    it("should include all unsafe content categories in prompt", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "safe",
      });

      await provider.validateContent("test content", "INPUT");

      const callArgs = mockAIProvider.getResponse.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      expect(prompt).toContain("S1: Violent Crimes");
      expect(prompt).toContain("S2: Non-Violent Crimes");
      expect(prompt).toContain("S3: Sex Crimes");
      expect(prompt).toContain("S4: Child Exploitation");
      expect(prompt).toContain("S5: Defamation");
      expect(prompt).toContain("S6: Specialized Advice");
      expect(prompt).toContain("S7: Privacy");
      expect(prompt).toContain("S8: Intellectual Property");
      expect(prompt).toContain("S9: Indiscriminate Weapons");
      expect(prompt).toContain("S10: Hate");
      expect(prompt).toContain("S11: Self-Harm");
      expect(prompt).toContain("S12: Sexual Content");
      expect(prompt).toContain("S13: Elections");
    });

    it("should pass user ID to AI provider", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "safe",
      });

      await provider.validateContent("test content", "INPUT");

      expect(mockAIProvider.getResponse).toHaveBeenCalledWith(
        expect.any(Object),
        "user-123",
      );
    });

    it("should use auxiliary guardrails model", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "safe",
      });

      await provider.validateContent("test content", "INPUT");

      expect(mockGetAuxiliaryGuardrailsModel).toHaveBeenCalledWith(
        mockConfig.env,
        mockConfig.user,
      );

      const callArgs = mockAIProvider.getResponse.mock.calls[0][0];
      expect(callArgs.model).toBe("llama-guard-model");
      expect(callArgs.env).toBe(mockConfig.env);
      expect(callArgs.user).toBe(mockConfig.user);
    });

    it("should handle AI provider errors", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockRejectedValue(
        new Error("AI provider error"),
      );

      const result = await provider.validateContent("test content", "INPUT");

      expect(result).toBeUndefined();
    });

    it("should re-throw AssistantError", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      const assistantError = new AssistantError(
        "Custom error",
        ErrorType.PROVIDER_ERROR,
      );
      mockAIProvider.getResponse.mockRejectedValue(assistantError);

      await expect(
        provider.validateContent("test content", "INPUT"),
      ).rejects.toThrow(AssistantError);
    });

    it("should handle case-insensitive safe responses", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "SAFE - content is acceptable",
      });

      const result = await provider.validateContent("test content", "INPUT");

      expect(result.isValid).toBe(true);
    });

    it("should handle case-insensitive allowed responses", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "ALLOWED - content is fine",
      });

      const result = await provider.validateContent("test content", "INPUT");

      expect(result.isValid).toBe(true);
    });

    it("should handle edge cases with whitespace", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "  safe  ",
      });

      const result = await provider.validateContent("test content", "INPUT");
      expect(result.isValid).toBe(true);
    });

    it("should handle responses that contain 'safe' but don't start with it", async () => {
      const provider = new LlamaGuardProvider(mockConfig);

      mockAIProvider.getResponse.mockResolvedValue({
        response: "This content is not safe",
      });

      const result = await provider.validateContent("test content", "INPUT");
      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual(["This content is not safe"]);
    });
  });
});
