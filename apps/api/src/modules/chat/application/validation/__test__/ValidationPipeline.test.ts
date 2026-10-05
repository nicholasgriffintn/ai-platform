import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ValidationContext } from "~/modules/chat/application/validation/ValidationPipeline";
import { ValidationPipeline } from "~/modules/chat/application/validation/ValidationPipeline";
import type { CoreChatOptions } from "~/types";

const mockBasicInputValidator = {
  validate: vi.fn(),
};
let basicInputValidatorFactory: (() => any) | undefined;

const mockAuthValidator = {
  validate: vi.fn(),
};
let authValidatorFactory: (() => any) | undefined;

const mockModelConfigValidator = {
  validate: vi.fn(),
};
let modelConfigValidatorFactory: (() => any) | undefined;

const mockContextLimitValidator = {
  validate: vi.fn(),
};
let contextLimitValidatorFactory: (() => any) | undefined;

const mockGuardrailsValidator = {
  validate: vi.fn(),
};
let guardrailsValidatorFactory: (() => any) | undefined;

vi.mock("~/modules/chat/application/validation/validators/BasicInputValidator", () => ({
  BasicInputValidator: class {
    constructor() {
      if (basicInputValidatorFactory) {
        return basicInputValidatorFactory();
      }

      return mockBasicInputValidator;
    }
  },
}));

vi.mock("~/modules/chat/application/validation/validators/AuthValidator", () => ({
  AuthValidator: class {
    constructor() {
      if (authValidatorFactory) {
        return authValidatorFactory();
      }

      return mockAuthValidator;
    }
  },
}));

vi.mock("~/modules/chat/application/validation/validators/ModelConfigValidator", () => ({
  ModelConfigValidator: class {
    constructor() {
      if (modelConfigValidatorFactory) {
        return modelConfigValidatorFactory();
      }

      return mockModelConfigValidator;
    }
  },
}));

vi.mock("~/modules/chat/application/validation/validators/ContextLimitValidator", () => ({
  ContextLimitValidator: class {
    constructor() {
      if (contextLimitValidatorFactory) {
        return contextLimitValidatorFactory();
      }

      return mockContextLimitValidator;
    }
  },
}));

vi.mock("~/modules/chat/application/validation/validators/GuardrailsValidator", () => ({
  GuardrailsValidator: class {
    constructor() {
      if (guardrailsValidatorFactory) {
        return guardrailsValidatorFactory();
      }

      return mockGuardrailsValidator;
    }
  },
}));

describe("ValidationPipeline", () => {
  let pipeline: ValidationPipeline;
  let baseOptions: CoreChatOptions;
  let baseContext: ValidationContext;

  beforeEach(() => {
    vi.clearAllMocks();

    authValidatorFactory = () => mockAuthValidator;
    basicInputValidatorFactory = () => mockBasicInputValidator;
    modelConfigValidatorFactory = () => mockModelConfigValidator;
    contextLimitValidatorFactory = () => mockContextLimitValidator;
    guardrailsValidatorFactory = () => mockGuardrailsValidator;

    pipeline = new ValidationPipeline();

    const env: any = {
      DB: {} as any,
      AI: {} as any,
      AWS_REGION: "us-east-1",
    };

    baseOptions = {
      env,
      context: createServiceContext({
        env,
        user: {
          id: 123,
          email: "test@example.com",
          plan_id: "pro",
        } as any,
      }),
      messages: [
        {
          role: "user",
          content: "Hello world",
        },
      ],
      completion_id: "completion-123",
      platform: "api",
      mode: "normal",
    };

    baseContext = {};

    mockBasicInputValidator.validate.mockResolvedValue({
      validation: { isValid: true },
      context: {
        sanitisedMessages: [{ role: "user", content: "Hello world" }],
        lastMessage: { role: "user", content: "Hello world" },
      },
    });

    mockAuthValidator.validate.mockResolvedValue({
      validation: { isValid: true },
      context: {},
    });

    mockModelConfigValidator.validate.mockResolvedValue({
      validation: { isValid: true },
      context: {
        modelConfig: {
          matchingModel: "claude-3-sonnet",
          provider: "anthropic",
        },
        selectedModels: ["claude-3-sonnet"],
      },
    });

    mockContextLimitValidator.validate.mockResolvedValue({
      validation: { isValid: true },
      context: {
        messageWithContext: "Hello world",
      },
    });

    mockGuardrailsValidator.validate.mockResolvedValue({
      validation: { isValid: true },
      context: {
        guardrails: {},
      },
    });
  });

  describe("validate", () => {
    it("should run all validators successfully and return valid result", async () => {
      const result = await pipeline.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context).toEqual({
        sanitisedMessages: [{ role: "user", content: "Hello world" }],
        lastMessage: { role: "user", content: "Hello world" },
        modelConfig: {
          matchingModel: "claude-3-sonnet",
          provider: "anthropic",
        },
        selectedModels: ["claude-3-sonnet"],
        messageWithContext: "Hello world",
        guardrails: {},
      });

      expect(mockBasicInputValidator.validate).toHaveBeenCalledWith(baseOptions, baseContext);
      expect(mockAuthValidator.validate).toHaveBeenCalled();
      expect(mockModelConfigValidator.validate).toHaveBeenCalled();
      expect(mockContextLimitValidator.validate).toHaveBeenCalled();
      expect(mockGuardrailsValidator.validate).toHaveBeenCalled();
    });

    it("should stop and return error when BasicInputValidator fails", async () => {
      mockBasicInputValidator.validate.mockResolvedValue({
        validation: {
          isValid: false,
          error: "Invalid input",
          validationType: "input",
        },
        context: {},
      });

      const result = await pipeline.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Invalid input");
      expect(result.validation.validationType).toBe("input");

      expect(mockAuthValidator.validate).toHaveBeenCalled();
      expect(mockBasicInputValidator.validate).toHaveBeenCalled();
      expect(mockModelConfigValidator.validate).not.toHaveBeenCalled();
      expect(mockContextLimitValidator.validate).not.toHaveBeenCalled();
      expect(mockGuardrailsValidator.validate).not.toHaveBeenCalled();
    });
  });

  describe("removeValidator", () => {
    it("should continue pipeline when removed validator would have failed", async () => {
      class FailingValidator {
        validate = vi.fn().mockResolvedValue({
          validation: {
            isValid: false,
            error: "This would fail",
            validationType: "input",
          },
          context: {},
        });
      }

      const failingValidator = new FailingValidator();

      pipeline.addValidator(failingValidator);

      let result = await pipeline.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(false);

      vi.clearAllMocks();
      pipeline.removeValidator(FailingValidator);

      result = await pipeline.validate(baseOptions, baseContext);
      expect(result.validation.isValid).toBe(true);
      expect(failingValidator.validate).not.toHaveBeenCalled();
    });
  });
});
