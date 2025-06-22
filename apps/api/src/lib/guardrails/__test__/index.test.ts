import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackGuardrailViolation } from "~/lib/monitoring";
import { AssistantError, ErrorType } from "~/utils/errors";
import { GuardrailsProviderFactory } from "../factory";
import { Guardrails } from "../index";

vi.mock("~/lib/monitoring");
vi.mock("~/lib/guardrails/factory");

const mockTrackGuardrailViolation = vi.mocked(trackGuardrailViolation);
const mockGuardrailsProviderFactory = vi.mocked(GuardrailsProviderFactory);

const mockProvider = {
  validateContent: vi.fn(),
};

describe("Guardrails", () => {
  const mockEnv = {
    AWS_REGION: "us-east-1",
    BEDROCK_AWS_ACCESS_KEY: "test-access-key",
    BEDROCK_AWS_SECRET_KEY: "test-secret-key",
    AI: {},
    ANALYTICS: {},
  } as any;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (Guardrails as any).instance = null;
    mockGuardrailsProviderFactory.getProvider.mockReturnValue(mockProvider);
  });

  describe("getInstance", () => {
    it("should create singleton instance", () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "llamaguard",
      } as any;

      const instance1 = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const instance2 = Guardrails.getInstance(mockEnv, mockUser, userSettings);

      expect(instance1).toBe(instance2);
    });

    it("should initialize with disabled guardrails", () => {
      const userSettings = {
        guardrails_enabled: false,
      } as any;

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      expect(instance).toBeDefined();
    });

    it("should initialize with bedrock provider", () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "bedrock",
        bedrock_guardrail_id: "test-guardrail-id",
        bedrock_guardrail_version: "1",
      } as any;

      Guardrails.getInstance(mockEnv, mockUser, userSettings);

      expect(mockGuardrailsProviderFactory.getProvider).toHaveBeenCalledWith(
        "bedrock",
        {
          guardrailId: "test-guardrail-id",
          guardrailVersion: "1",
          region: "us-east-1",
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
          env: mockEnv,
        },
        mockUser,
      );
    });

    it("should initialize with llamaguard provider as default", () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "unknown",
      } as any;

      Guardrails.getInstance(mockEnv, mockUser, userSettings);

      expect(mockGuardrailsProviderFactory.getProvider).toHaveBeenCalledWith(
        "llamaguard",
        {
          ai: mockEnv.AI,
          env: mockEnv,
          user: mockUser,
        },
      );
    });

    it("should throw error for bedrock without guardrail ID", () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "bedrock",
      } as any;

      expect(() => {
        Guardrails.getInstance(mockEnv, mockUser, userSettings);
      }).toThrow(AssistantError);

      expect(() => {
        Guardrails.getInstance(mockEnv, mockUser, userSettings);
      }).toThrow("Missing required guardrail ID");
    });

    it("should use default bedrock guardrail version", () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "bedrock",
        bedrock_guardrail_id: "test-guardrail-id",
      } as any;

      Guardrails.getInstance(mockEnv, mockUser, userSettings);

      expect(mockGuardrailsProviderFactory.getProvider).toHaveBeenCalledWith(
        "bedrock",
        expect.objectContaining({
          guardrailVersion: "1",
        }),
        mockUser,
      );
    });
  });

  describe("validateInput", () => {
    it("should return valid result when guardrails disabled", async () => {
      const userSettings = {
        guardrails_enabled: false,
      } as any;

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const result = await instance.validateInput("test message");

      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(mockProvider.validateContent).not.toHaveBeenCalled();
    });

    it("should validate input content when enabled", async () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "llamaguard",
      } as any;

      mockProvider.validateContent.mockResolvedValue({
        isValid: true,
        violations: [],
      });

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const result = await instance.validateInput("test message");

      expect(mockProvider.validateContent).toHaveBeenCalledWith(
        "test message",
        "INPUT",
      );
      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it("should track violations for invalid input", async () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "llamaguard",
      } as any;

      mockProvider.validateContent.mockResolvedValue({
        isValid: false,
        violations: ["Violence detected"],
      });

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const result = await instance.validateInput(
        "violent message",
        123,
        "completion-456",
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual(["Violence detected"]);
      expect(mockTrackGuardrailViolation).toHaveBeenCalledWith(
        "input_violation",
        {
          message: "violent message",
          violations: ["Violence detected"],
        },
        mockEnv.ANALYTICS,
        123,
        "completion-456",
      );
    });

    it("should not track violations for valid input", async () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "llamaguard",
      } as any;

      mockProvider.validateContent.mockResolvedValue({
        isValid: true,
        violations: [],
      });

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      await instance.validateInput("safe message", 123, "completion-456");

      expect(mockTrackGuardrailViolation).not.toHaveBeenCalled();
    });
  });

  describe("validateOutput", () => {
    it("should return valid result when guardrails disabled", async () => {
      const userSettings = {
        guardrails_enabled: false,
      } as any;

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const result = await instance.validateOutput("test response");

      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(mockProvider.validateContent).not.toHaveBeenCalled();
    });

    it("should validate output content when enabled", async () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "llamaguard",
      } as any;

      mockProvider.validateContent.mockResolvedValue({
        isValid: true,
        violations: [],
      });

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const result = await instance.validateOutput("test response");

      expect(mockProvider.validateContent).toHaveBeenCalledWith(
        "test response",
        "OUTPUT",
      );
      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it("should track violations for invalid output", async () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "llamaguard",
      } as any;

      mockProvider.validateContent.mockResolvedValue({
        isValid: false,
        violations: ["Inappropriate content"],
      });

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const result = await instance.validateOutput(
        "inappropriate response",
        123,
        "completion-456",
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual(["Inappropriate content"]);
      expect(mockTrackGuardrailViolation).toHaveBeenCalledWith(
        "output_violation",
        {
          response: "inappropriate response",
          violations: ["Inappropriate content"],
        },
        mockEnv.ANALYTICS,
        123,
        "completion-456",
      );
    });

    it("should handle undefined violations", async () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "llamaguard",
      } as any;

      mockProvider.validateContent.mockResolvedValue({
        isValid: false,
        violations: undefined,
      });

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const result = await instance.validateOutput("test response");

      expect(result.isValid).toBe(false);
      expect(mockTrackGuardrailViolation).not.toHaveBeenCalled();
    });

    it("should handle empty violations array", async () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "llamaguard",
      } as any;

      mockProvider.validateContent.mockResolvedValue({
        isValid: false,
        violations: [],
      });

      const instance = Guardrails.getInstance(mockEnv, mockUser, userSettings);
      const result = await instance.validateOutput("test response");

      expect(result.isValid).toBe(false);
      expect(mockTrackGuardrailViolation).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle constructor errors gracefully", () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "bedrock",
      } as any;

      expect(() => {
        Guardrails.getInstance(mockEnv, mockUser, userSettings);
      }).toThrow(AssistantError);
    });

    it("should propagate error type correctly", () => {
      const userSettings = {
        guardrails_enabled: true,
        guardrails_provider: "bedrock",
      } as any;

      try {
        Guardrails.getInstance(mockEnv, mockUser, userSettings);
      } catch (error) {
        expect(error).toBeInstanceOf(AssistantError);
        expect((error as AssistantError).type).toBe(ErrorType.PARAMS_ERROR);
      }
    });
  });
});
