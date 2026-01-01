import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoreChatOptions } from "~/types";
import type {
	ValidationContext,
	Validator,
	ValidatorResult,
} from "../ValidationPipeline";
import { ValidationPipeline } from "../ValidationPipeline";

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

vi.mock("../validators/BasicInputValidator", () => ({
	BasicInputValidator: class {
		constructor() {
			if (basicInputValidatorFactory) {
				return basicInputValidatorFactory();
			}
			return mockBasicInputValidator;
		}
	},
}));

vi.mock("../validators/AuthValidator", () => ({
	AuthValidator: class {
		constructor() {
			if (authValidatorFactory) {
				return authValidatorFactory();
			}
			return mockAuthValidator;
		}
	},
}));

vi.mock("../validators/ModelConfigValidator", () => ({
	ModelConfigValidator: class {
		constructor() {
			if (modelConfigValidatorFactory) {
				return modelConfigValidatorFactory();
			}
			return mockModelConfigValidator;
		}
	},
}));

vi.mock("../validators/ContextLimitValidator", () => ({
	ContextLimitValidator: class {
		constructor() {
			if (contextLimitValidatorFactory) {
				return contextLimitValidatorFactory();
			}
			return mockContextLimitValidator;
		}
	},
}));

vi.mock("../validators/GuardrailsValidator", () => ({
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

		baseOptions = {
			// @ts-expect-error - mock implementation
			env: {
				DB: {} as any,
				AI: {} as any,
				AWS_REGION: "us-east-1",
			},
			// @ts-expect-error - mock implementation
			user: {
				id: 123,
				email: "test@example.com",
				plan_id: "pro",
			},
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
				sanitizedMessages: [{ role: "user", content: "Hello world" }],
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
				sanitizedMessages: [{ role: "user", content: "Hello world" }],
				lastMessage: { role: "user", content: "Hello world" },
				modelConfig: {
					matchingModel: "claude-3-sonnet",
					provider: "anthropic",
				},
				selectedModels: ["claude-3-sonnet"],
				messageWithContext: "Hello world",
				guardrails: {},
			});

			expect(mockBasicInputValidator.validate).toHaveBeenCalledWith(
				baseOptions,
				baseContext,
			);
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

		it("should stop and return error when AuthValidator fails", async () => {
			mockAuthValidator.validate.mockResolvedValue({
				validation: {
					isValid: false,
					error: "Authentication failed",
					validationType: "auth",
				},
				context: {},
			});

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Authentication failed");
			expect(result.validation.validationType).toBe("auth");

			expect(mockBasicInputValidator.validate).not.toHaveBeenCalled();
			expect(mockAuthValidator.validate).toHaveBeenCalled();
			expect(mockModelConfigValidator.validate).not.toHaveBeenCalled();
		});

		it("should stop and return error when ModelConfigValidator fails", async () => {
			mockModelConfigValidator.validate.mockResolvedValue({
				validation: {
					isValid: false,
					error: "Invalid model configuration",
					validationType: "model",
				},
				context: {},
			});

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Invalid model configuration");
			expect(result.validation.validationType).toBe("model");

			expect(mockBasicInputValidator.validate).toHaveBeenCalled();
			expect(mockAuthValidator.validate).toHaveBeenCalled();
			expect(mockModelConfigValidator.validate).toHaveBeenCalled();
			expect(mockContextLimitValidator.validate).not.toHaveBeenCalled();
		});

		it("should stop and return error when ContextLimitValidator fails", async () => {
			mockContextLimitValidator.validate.mockResolvedValue({
				validation: {
					isValid: false,
					error: "Context window exceeded",
					validationType: "context",
				},
				context: {},
			});

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Context window exceeded");
			expect(result.validation.validationType).toBe("context");

			expect(mockGuardrailsValidator.validate).not.toHaveBeenCalled();
		});

		it("should stop and return error when GuardrailsValidator fails", async () => {
			mockGuardrailsValidator.validate.mockResolvedValue({
				validation: {
					isValid: false,
					error: "Content violates policy",
					validationType: "input",
					violations: ["inappropriate_content"],
					rawViolations: { blockedResponse: "Content blocked" },
				},
				context: {},
			});

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Content violates policy");
			expect(result.validation.violations).toEqual(["inappropriate_content"]);
			expect(result.validation.rawViolations).toEqual({
				blockedResponse: "Content blocked",
			});
		});

		it("should handle empty initial context", async () => {
			const result = await pipeline.validate(baseOptions);

			expect(result.validation.isValid).toBe(true);
			expect(mockBasicInputValidator.validate).toHaveBeenCalledWith(
				baseOptions,
				{},
			);
		});

		it("should merge context from each validator", async () => {
			const result = await pipeline.validate(baseOptions, {
				// @ts-expect-error - mock implementation
				existingKey: "value",
			});

			expect(result.context).toEqual({
				existingKey: "value",
				sanitizedMessages: [{ role: "user", content: "Hello world" }],
				lastMessage: { role: "user", content: "Hello world" },
				modelConfig: {
					matchingModel: "claude-3-sonnet",
					provider: "anthropic",
				},
				selectedModels: ["claude-3-sonnet"],
				messageWithContext: "Hello world",
				guardrails: {},
			});
		});

		it("should handle validator that returns undefined result", async () => {
			mockBasicInputValidator.validate.mockResolvedValue(undefined);

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Validator returned invalid result");
			expect(result.context).toEqual(baseContext);
		});

		it("should handle validator that returns result with undefined validation", async () => {
			mockBasicInputValidator.validate.mockResolvedValue({
				validation: undefined,
				context: {},
			});

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Validator returned invalid result");
			expect(result.context).toEqual(baseContext);
		});
	});

	describe("addValidator", () => {
		it("should add custom validator to pipeline", async () => {
			const customValidator: Validator = {
				validate: vi.fn().mockResolvedValue({
					validation: { isValid: true },
					context: { customField: "value" },
				}),
			};

			pipeline.addValidator(customValidator);

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			// @ts-expect-error - mock implementation
			expect(result.context.customField).toBe("value");
			expect(customValidator.validate).toHaveBeenCalled();
		});

		it("should run custom validator after built-in validators", async () => {
			const customValidator: Validator = {
				validate: vi.fn().mockResolvedValue({
					validation: { isValid: true },
					context: { customField: "value" },
				}),
			};

			pipeline.addValidator(customValidator);

			await pipeline.validate(baseOptions, baseContext);

			expect(mockGuardrailsValidator.validate).toHaveBeenCalled();
			expect(customValidator.validate).toHaveBeenCalled();

			const guardrailsCall =
				mockGuardrailsValidator.validate.mock.invocationCallOrder[0];
			const customCall = (customValidator.validate as any).mock
				.invocationCallOrder[0];
			expect(guardrailsCall).toBeLessThan(customCall);
		});

		it("should stop pipeline if custom validator fails", async () => {
			const customValidator: Validator = {
				validate: vi.fn().mockResolvedValue({
					validation: {
						isValid: false,
						error: "Custom validation failed",
						validationType: "input",
					},
					context: {},
				}),
			};

			pipeline.addValidator(customValidator);

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Custom validation failed");
		});
	});

	describe("removeValidator", () => {
		it("should remove validator from pipeline", async () => {
			class TestValidator {
				validate = vi.fn().mockResolvedValue({
					validation: { isValid: true },
					context: { testField: "removed" },
				});
			}

			const testValidator = new TestValidator();
			pipeline.addValidator(testValidator);

			await pipeline.validate(baseOptions, baseContext);
			expect(testValidator.validate).toHaveBeenCalled();

			vi.clearAllMocks();
			pipeline.removeValidator(TestValidator);

			const result = await pipeline.validate(baseOptions, baseContext);
			expect(result.validation.isValid).toBe(true);
			expect(testValidator.validate).not.toHaveBeenCalled();
		});

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

		it("should handle removing non-existent validator gracefully", async () => {
			class NonExistentValidator implements Validator {
				async validate(): Promise<ValidatorResult> {
					return {
						validation: { isValid: true },
						context: {},
					};
				}
			}

			pipeline.removeValidator(NonExistentValidator);

			const result = await pipeline.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
		});
	});
});
