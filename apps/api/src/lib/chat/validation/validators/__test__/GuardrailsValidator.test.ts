import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { CoreChatOptions } from "~/types";
import type { ValidationContext } from "../../ValidationPipeline";
import { GuardrailsValidator } from "../GuardrailsValidator";

const mockRepositories = {
	userSettings: {
		getUserSettings: vi.fn(),
	},
};

const mockGuardrails = {
	validateInput: vi.fn(),
};

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn(() => mockRepositories),
}));

vi.mock("~/lib/guardrails", () => ({
	Guardrails: vi.fn(() => mockGuardrails),
}));

describe("GuardrailsValidator", () => {
	let validator: GuardrailsValidator;
	let baseOptions: CoreChatOptions;
	let baseContext: ValidationContext;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { RepositoryManager } =
			await vi.importMock<typeof import("~/repositories")>("~/repositories");
		const { Guardrails } =
			await vi.importMock<typeof import("~/lib/guardrails")>(
				"~/lib/guardrails",
			);

		vi.mocked(RepositoryManager).mockImplementation(() => mockRepositories as any);
		(Guardrails as unknown as Mock).mockImplementation(
			() => mockGuardrails as any,
		);

		validator = new GuardrailsValidator();

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

		baseContext = {
			sanitizedMessages: [{ role: "user", content: "Hello world" }],
			lastMessage: { role: "user", content: "Hello world" },
			modelConfig: {
				matchingModel: "claude-3-sonnet",
				provider: "anthropic",
				contextWindow: 200000,
				maxOutputTokens: 4096,
			},
			messageWithContext: "Hello world",
		};

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({
			guardrails_enabled: true,
			guardrails_provider: "llamaguard",
		});

		mockGuardrails.validateInput.mockResolvedValue({
			isValid: true,
			violations: [],
		});
	});

	describe("validate", () => {
		it("should successfully validate with valid input", async () => {
			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(result.context.guardrails).toEqual(mockGuardrails);

			expect(mockRepositories.userSettings.getUserSettings).toHaveBeenCalledWith(123);
			expect(mockGuardrails.validateInput).toHaveBeenCalledWith(
				"Hello world",
				123,
				"completion-123",
			);
		});

		it("should fail validation when messageWithContext is missing", async () => {
			const contextWithoutMessage = {
				sanitizedMessages: [{ role: "user", content: "Hello world" }],
				lastMessage: { role: "user", content: "Hello world" },
				modelConfig: baseContext.modelConfig,
			};

			const result = await validator.validate(
				baseOptions,
				contextWithoutMessage,
			);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Missing message context for guardrails validation",
			);
			expect(result.validation.validationType).toBe("input");
			expect(result.context).toEqual({});
		});

		it("should fail validation when guardrails validation rejects input", async () => {
			mockGuardrails.validateInput.mockResolvedValue({
				isValid: false,
				violations: ["Violence detected", "Inappropriate content"],
				rawResponse: {
					blockedResponse: "Content contains violence",
					score: 0.95,
				},
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Content contains violence");
			expect(result.validation.violations).toEqual([
				"Violence detected",
				"Inappropriate content",
			]);
			expect(result.validation.rawViolations).toEqual({
				blockedResponse: "Content contains violence",
				score: 0.95,
			});
			expect(result.validation.validationType).toBe("input");
			expect(result.context).toEqual({});
		});

		it("should use default error message when guardrails validation fails without rawResponse", async () => {
			mockGuardrails.validateInput.mockResolvedValue({
				isValid: false,
				violations: ["Policy violation"],
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Input did not pass safety checks");
			expect(result.validation.violations).toEqual(["Policy violation"]);
			expect(result.validation.validationType).toBe("input");
		});

		it("should handle missing user id", async () => {
			const optionsWithoutUserId = {
				...baseOptions,
				user: {
					email: "test@example.com",
				} as any,
			};

			const result = await validator.validate(
				optionsWithoutUserId,
				baseContext,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockRepositories.userSettings.getUserSettings).not.toHaveBeenCalled();
			expect(mockGuardrails.validateInput).toHaveBeenCalledWith(
				"Hello world",
				undefined,
				"completion-123",
			);
		});

		it("should handle missing user entirely", async () => {
			const optionsWithoutUser = {
				...baseOptions,
				user: undefined,
			};

			const result = await validator.validate(optionsWithoutUser, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(mockRepositories.userSettings.getUserSettings).not.toHaveBeenCalled();
			expect(mockGuardrails.validateInput).toHaveBeenCalledWith(
				"Hello world",
				undefined,
				"completion-123",
			);
		});

		it("should handle missing completion_id", async () => {
			const optionsWithoutCompletionId = {
				...baseOptions,
				completion_id: undefined,
			};

			const result = await validator.validate(
				optionsWithoutCompletionId,
				baseContext,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockGuardrails.validateInput).toHaveBeenCalledWith(
				"Hello world",
				123,
				undefined,
			);
		});

		it("should handle database getUserSettings throwing an error", async () => {
			mockRepositories.userSettings.getUserSettings.mockRejectedValue(
				new Error("Database connection failed"),
			);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Guardrails validation failed: Database connection failed",
			);
			expect(result.validation.validationType).toBe("input");
			expect(result.context).toEqual({});
		});

		it("should handle guardrails validateInput throwing an error", async () => {
			mockGuardrails.validateInput.mockRejectedValue(
				new Error("Guardrails service unavailable"),
			);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Guardrails validation failed: Guardrails service unavailable",
			);
			expect(result.validation.validationType).toBe("input");
		});

		it("should handle Guardrails initialization throwing an error", async () => {
			const { Guardrails } = await import("~/lib/guardrails");
			(Guardrails as unknown as Mock).mockImplementation(() => {
				throw new Error("Guardrails initialization failed");
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Guardrails validation failed: Guardrails initialization failed",
			);
			expect(result.validation.validationType).toBe("input");
		});

		it("should handle RepositoryManager throwing an error", async () => {
			const { RepositoryManager } = await import("~/repositories");
			vi.mocked(RepositoryManager).mockImplementation(() => {
				throw new Error("RepositoryManager initialization failed");
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Guardrails validation failed: RepositoryManager initialization failed",
			);
			expect(result.validation.validationType).toBe("input");
		});

		it("should handle error without message", async () => {
			const errorWithoutMessage = new Error();
			errorWithoutMessage.message = undefined as any;

			const { RepositoryManager } =
				await vi.importMock<typeof import("~/repositories")>("~/repositories");
			vi.mocked(RepositoryManager).mockImplementation(() => {
				throw errorWithoutMessage;
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Guardrails validation failed: undefined",
			);
			expect(result.validation.validationType).toBe("input");
		});

		it("should handle complex messageWithContext", async () => {
			vi.clearAllMocks();

			mockRepositories.userSettings.getUserSettings.mockResolvedValue({
				guardrails_enabled: true,
				guardrails_provider: "llamaguard",
			});
			mockGuardrails.validateInput.mockResolvedValue({
				isValid: true,
				violations: [],
			});

			const complexContext = {
				...baseContext,
				messageWithContext:
					"User message with attachments\n\nContext from documents:\n# Document 1\nContent here",
			};

			const result = await validator.validate(baseOptions, complexContext);

			expect(result.validation.isValid).toBe(true);
			expect(mockGuardrails.validateInput).toHaveBeenCalledWith(
				"User message with attachments\n\nContext from documents:\n# Document 1\nContent here",
				123,
				"completion-123",
			);
		});

		it("should handle guardrails validation returning null", async () => {
			vi.clearAllMocks();

			mockRepositories.userSettings.getUserSettings.mockResolvedValue({
				guardrails_enabled: true,
				guardrails_provider: "llamaguard",
			});
			mockGuardrails.validateInput.mockResolvedValue(null);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Input did not pass safety checks");
			expect(result.validation.validationType).toBe("input");
		});

		it("should handle guardrails validation returning undefined", async () => {
			vi.clearAllMocks();

			mockRepositories.userSettings.getUserSettings.mockResolvedValue({
				guardrails_enabled: true,
				guardrails_provider: "llamaguard",
			});
			mockGuardrails.validateInput.mockResolvedValue(undefined);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Input did not pass safety checks");
			expect(result.validation.validationType).toBe("input");
		});

		it("should handle user settings with different guardrails configuration", async () => {
			vi.clearAllMocks();

			const userSettings = {
				guardrails_enabled: true,
				guardrails_provider: "bedrock",
				bedrock_guardrail_id: "test-guardrail-123",
			};

			mockRepositories.userSettings.getUserSettings.mockResolvedValue(userSettings);
			mockGuardrails.validateInput.mockResolvedValue({
				isValid: true,
				violations: [],
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(mockRepositories.userSettings.getUserSettings).toHaveBeenCalledWith(123);
		});

		it("should handle user settings returning null", async () => {
			vi.clearAllMocks();

			mockRepositories.userSettings.getUserSettings.mockResolvedValue(null);
			mockGuardrails.validateInput.mockResolvedValue({
				isValid: true,
				violations: [],
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
		});

		it("should handle user settings returning undefined", async () => {
			vi.clearAllMocks();

			mockRepositories.userSettings.getUserSettings.mockResolvedValue(undefined);
			mockGuardrails.validateInput.mockResolvedValue({
				isValid: true,
				violations: [],
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
		});

		it("should handle validation result with empty violations array", async () => {
			vi.clearAllMocks();

			mockRepositories.userSettings.getUserSettings.mockResolvedValue({
				guardrails_enabled: true,
				guardrails_provider: "llamaguard",
			});
			mockGuardrails.validateInput.mockResolvedValue({
				isValid: false,
				violations: [],
				rawResponse: {
					blockedResponse: "Generic violation",
				},
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.violations).toEqual([]);
			expect(result.validation.rawViolations).toEqual({
				blockedResponse: "Generic violation",
			});
		});

		it("should handle validation result with undefined violations", async () => {
			vi.clearAllMocks();

			mockRepositories.userSettings.getUserSettings.mockResolvedValue({
				guardrails_enabled: true,
				guardrails_provider: "llamaguard",
			});
			mockGuardrails.validateInput.mockResolvedValue({
				isValid: false,
				violations: undefined,
				rawResponse: {
					blockedResponse: "Violation detected",
				},
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.violations).toBeUndefined();
			expect(result.validation.rawViolations).toEqual({
				blockedResponse: "Violation detected",
			});
		});
	});
});
