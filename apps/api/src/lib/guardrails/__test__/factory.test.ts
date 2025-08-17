import { describe, expect, it } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { BedrockGuardrailsProvider } from "../bedrock";
import { GuardrailsProviderFactory } from "../factory";
import { LlamaGuardProvider } from "../llamaguard";

describe("GuardrailsProviderFactory", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  } as any;

  describe("getProvider", () => {
    it("should create BedrockGuardrailsProvider for bedrock type", () => {
      const config = {
        guardrailId: "test-guardrail-id",
        guardrailVersion: "1",
        region: "us-east-1",
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
        env: { DB: {} } as any,
      };

      const provider = GuardrailsProviderFactory.getProvider(
        "bedrock",
        config,
        mockUser,
      );

      expect(provider).toBeInstanceOf(BedrockGuardrailsProvider);
    });

    it("should create LlamaGuardProvider for llamaguard type", () => {
      const config = {
        ai: {} as any,
        env: { AI: {} } as any,
        user: mockUser,
      };

      const provider = GuardrailsProviderFactory.getProvider(
        "llamaguard",
        config,
      );

      expect(provider).toBeInstanceOf(LlamaGuardProvider);
    });

    it("should throw error for unsupported provider type", () => {
      const config = {
        guardrailId: "test-guardrail-id",
        env: {} as any,
      };

      expect(() => {
        GuardrailsProviderFactory.getProvider("unsupported", config);
      }).toThrow(expect.any(AssistantError));

      expect(() => {
        GuardrailsProviderFactory.getProvider("unsupported", config);
      }).toThrow("Unsupported guardrails provider: unsupported");
    });

    it("should throw error for bedrock with invalid config", () => {
      const invalidConfig = {
        ai: {} as any,
        env: {} as any,
      };

      expect(() => {
        GuardrailsProviderFactory.getProvider("bedrock", invalidConfig);
      }).toThrow(expect.any(AssistantError));

      expect(() => {
        GuardrailsProviderFactory.getProvider("bedrock", invalidConfig);
      }).toThrow("Invalid config for Bedrock provider");
    });

    it("should throw error for llamaguard with invalid config", () => {
      const invalidConfig = {
        guardrailId: "test-id",
        env: {} as any,
      };

      expect(() => {
        GuardrailsProviderFactory.getProvider("llamaguard", invalidConfig);
      }).toThrow(expect.any(AssistantError));

      expect(() => {
        GuardrailsProviderFactory.getProvider("llamaguard", invalidConfig);
      }).toThrow("Invalid config for LlamaGuard provider");
    });

    it("should create providers without user parameter", () => {
      const bedrockConfig = {
        guardrailId: "test-guardrail-id",
        env: { DB: {} } as any,
      };

      const llamaguardConfig = {
        ai: {} as any,
        env: { AI: {} } as any,
      };

      const bedrockProvider = GuardrailsProviderFactory.getProvider(
        "bedrock",
        bedrockConfig,
      );
      const llamaguardProvider = GuardrailsProviderFactory.getProvider(
        "llamaguard",
        llamaguardConfig,
      );

      expect(bedrockProvider).toBeInstanceOf(BedrockGuardrailsProvider);
      expect(llamaguardProvider).toBeInstanceOf(LlamaGuardProvider);
    });

    it("should handle error types correctly", () => {
      const config = {} as any;

      try {
        GuardrailsProviderFactory.getProvider("invalid", config);
      } catch (error) {
        expect(error).toBeInstanceOf(AssistantError);
        expect((error as AssistantError).type).toBe(ErrorType.PARAMS_ERROR);
      }
    });
  });
});
