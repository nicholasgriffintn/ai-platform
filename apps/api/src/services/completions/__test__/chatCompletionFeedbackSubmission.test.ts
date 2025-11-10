import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleChatCompletionFeedbackSubmission } from "../chatCompletionFeedbackSubmission";
import { RepositoryManager } from "~/repositories";

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn(),
}));

const mockGateway = {
	patchLog: vi.fn(),
};

const mockAI = {
	gateway: vi.fn(() => mockGateway),
};

const mockEnv = {
	AI_GATEWAY_TOKEN: "test-token",
	ACCOUNT_ID: "test-account",
	AI: mockAI,
} as any;

const mockUser = {
	email: "test@example.com",
} as any;

describe("handleChatCompletionFeedbackSubmission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(RepositoryManager).mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("parameter validation", () => {
		it("should throw error for missing request", async () => {
			await expect(() =>
				handleChatCompletionFeedbackSubmission({
					request: null as any,
					env: mockEnv,
					user: mockUser,
					completion_id: "completion-123",
				}),
			).rejects.toThrow("Missing request");
		});

		it("should throw error for missing feedback", async () => {
			const request = {
				log_id: "log-123",
			} as any;

			await expect(() =>
				handleChatCompletionFeedbackSubmission({
					request,
					env: mockEnv,
					user: mockUser,
					completion_id: "completion-123",
				}),
			).rejects.toThrow("Missing feedback");
		});

		it("should succeed without log_id when only feedback is provided", async () => {
			const mockRepositories = {
				trainingExamples: {
					findMany: vi.fn().mockResolvedValue([]),
				},
			};

			const mockEnvWithRepos = {
				...mockEnv,
				DB: {} as any,
			};

			vi.mocked(RepositoryManager).mockImplementation(
				() => mockRepositories as any,
			);

			const request = {
				feedback: "positive",
			} as any;

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnvWithRepos,
				user: mockUser,
				completion_id: "completion-123",
			});

			expect(result.success).toBe(true);
			expect(mockGateway.patchLog).not.toHaveBeenCalled();
		});

		it("should succeed without AI_GATEWAY_TOKEN when log_id not provided", async () => {
			const envWithoutToken = {
				ACCOUNT_ID: "test-account",
				AI: mockAI,
				DB: {} as any,
			} as any;

			const mockRepositories = {
				trainingExamples: {
					findMany: vi.fn().mockResolvedValue([]),
				},
			};

			vi.mocked(RepositoryManager).mockImplementation(
				() => mockRepositories as any,
			);

			const request = {
				feedback: "positive",
			} as any;

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: envWithoutToken,
				user: mockUser,
				completion_id: "completion-123",
			});

			expect(result.success).toBe(true);
			expect(mockGateway.patchLog).not.toHaveBeenCalled();
		});
	});

	describe("successful feedback submission", () => {
		it("should submit positive feedback successfully", async () => {
			const completionId = "completion-123";
			const request = {
				log_id: "log-123",
				feedback: "positive",
				score: 5,
			} as any;

			mockGateway.patchLog.mockResolvedValue(undefined);

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnv,
				user: mockUser,
				completion_id: completionId,
			});

			expect(mockAI.gateway).toHaveBeenCalledWith("llm-assistant");
			expect(mockGateway.patchLog).toHaveBeenCalledWith("log-123", {
				feedback: "positive",
				score: 5,
				metadata: {
					user: "test@example.com",
				},
			});
			expect(result).toEqual({
				success: true,
				message: "Feedback submitted successfully",
				completion_id: completionId,
			});
		});

		it("should submit negative feedback successfully", async () => {
			const completionId = "completion-456";
			const request = {
				log_id: "log-456",
				feedback: "negative",
				score: 1,
			} as any;

			mockGateway.patchLog.mockResolvedValue(undefined);

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnv,
				user: mockUser,
				completion_id: completionId,
			});

			expect(mockGateway.patchLog).toHaveBeenCalledWith("log-456", {
				feedback: "negative",
				score: 1,
				metadata: {
					user: "test@example.com",
				},
			});
			expect(result).toEqual({
				success: true,
				message: "Feedback submitted successfully",
				completion_id: completionId,
			});
		});

		it("should submit feedback without score", async () => {
			const completionId = "completion-no-score";
			const request = {
				log_id: "log-no-score",
				feedback: "helpful",
			} as any;

			mockGateway.patchLog.mockResolvedValue(undefined);

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnv,
				user: mockUser,
				completion_id: completionId,
			});

			expect(mockGateway.patchLog).toHaveBeenCalledWith("log-no-score", {
				feedback: "helpful",
				score: undefined,
				metadata: {
					user: "test@example.com",
				},
			});
			expect(result.success).toBe(true);
		});

		it("should handle different feedback types", async () => {
			const feedbackTypes = [
				"thumbs_up",
				"thumbs_down",
				"helpful",
				"not_helpful",
				"accurate",
				"inaccurate",
			];

			for (const feedbackType of feedbackTypes) {
				const request = {
					log_id: `log-${feedbackType}`,
					feedback: feedbackType,
					score: 3,
				} as any;

				mockGateway.patchLog.mockResolvedValue(undefined);

				const result = await handleChatCompletionFeedbackSubmission({
					request,
					env: mockEnv,
					user: mockUser,
					completion_id: `completion-${feedbackType}`,
				});

				expect(mockGateway.patchLog).toHaveBeenCalledWith(
					`log-${feedbackType}`,
					{
						feedback: feedbackType,
						score: 3,
						metadata: {
							user: "test@example.com",
						},
					},
				);
				expect(result.success).toBe(true);
			}
		});

		it("should handle different score values", async () => {
			const scores = [1, 2, 3, 4, 5];

			for (const score of scores) {
				const request = {
					log_id: `log-score-${score}`,
					feedback: "rating",
					score,
				} as any;

				mockGateway.patchLog.mockResolvedValue(undefined);

				const result = await handleChatCompletionFeedbackSubmission({
					request,
					env: mockEnv,
					user: mockUser,
					completion_id: `completion-score-${score}`,
				});

				expect(mockGateway.patchLog).toHaveBeenCalledWith(
					`log-score-${score}`,
					{
						feedback: "rating",
						score,
						metadata: {
							user: "test@example.com",
						},
					},
				);
				expect(result.success).toBe(true);
			}
		});
	});

	describe("user context", () => {
		it("should include user email in metadata", async () => {
			const request = {
				log_id: "log-with-user",
				feedback: "positive",
			} as any;

			const userWithEmail = {
				email: "specific-user@example.com",
			} as any;

			mockGateway.patchLog.mockResolvedValue(undefined);

			await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnv,
				user: userWithEmail,
				completion_id: "completion-user",
			});

			expect(mockGateway.patchLog).toHaveBeenCalledWith("log-with-user", {
				feedback: "positive",
				score: undefined,
				metadata: {
					user: "specific-user@example.com",
				},
			});
		});

		it("should handle user without email", async () => {
			const request = {
				log_id: "log-no-email",
				feedback: "positive",
			} as any;

			const userWithoutEmail = {} as any;

			mockGateway.patchLog.mockResolvedValue(undefined);

			await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnv,
				user: userWithoutEmail,
				completion_id: "completion-no-email",
			});

			expect(mockGateway.patchLog).toHaveBeenCalledWith("log-no-email", {
				feedback: "positive",
				score: undefined,
				metadata: {
					user: undefined,
				},
			});
		});
	});

	describe("error handling", () => {
		it("should succeed even when gateway patch log fails", async () => {
			const mockRepositories = {
				trainingExamples: {
					findMany: vi.fn().mockResolvedValue([]),
				},
			};

			const mockEnvWithRepos = {
				...mockEnv,
				DB: {} as any,
			};

			vi.mocked(RepositoryManager).mockImplementation(
				() => mockRepositories as any,
			);

			const request = {
				log_id: "log-error",
				feedback: "positive",
			} as any;

			mockGateway.patchLog.mockRejectedValue(
				new Error("Gateway service unavailable"),
			);

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnvWithRepos,
				user: mockUser,
				completion_id: "completion-error",
			});

			expect(result.success).toBe(true);
			expect(mockRepositories.trainingExamples.findMany).toHaveBeenCalled();
		});

		it("should succeed even when gateway initialization fails", async () => {
			const mockRepositories = {
				trainingExamples: {
					findMany: vi.fn().mockResolvedValue([]),
				},
			};

			vi.mocked(RepositoryManager).mockImplementation(
				() => mockRepositories as any,
			);

			const request = {
				log_id: "log-init-error",
				feedback: "positive",
			} as any;

			const envWithFailingGateway = {
				AI_GATEWAY_TOKEN: "test-token",
				ACCOUNT_ID: "test-account",
				DB: {} as any,
				AI: {
					gateway: vi.fn(() => {
						throw new Error("Gateway initialization failed");
					}),
				},
			} as any;

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: envWithFailingGateway,
				user: mockUser,
				completion_id: "completion-init-error",
			});

			expect(result.success).toBe(true);
			expect(mockRepositories.trainingExamples.findMany).toHaveBeenCalled();
		});

		it("should succeed even with invalid log ID", async () => {
			const mockRepositories = {
				trainingExamples: {
					findMany: vi.fn().mockResolvedValue([]),
				},
			};

			const mockEnvWithRepos = {
				...mockEnv,
				DB: {} as any,
			};

			vi.mocked(RepositoryManager).mockImplementation(
				() => mockRepositories as any,
			);

			const request = {
				log_id: "invalid-log-id",
				feedback: "positive",
			} as any;

			mockGateway.patchLog.mockRejectedValue(new Error("Log not found"));

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnvWithRepos,
				user: mockUser,
				completion_id: "completion-invalid-log",
			});

			expect(result.success).toBe(true);
			expect(mockRepositories.trainingExamples.findMany).toHaveBeenCalled();
		});
	});

	describe("response format", () => {
		it("should return consistent response format", async () => {
			const completionId = "completion-format-test";
			const request = {
				log_id: "log-format-test",
				feedback: "positive",
				score: 4,
			} as any;

			mockGateway.patchLog.mockResolvedValue(undefined);

			const result = await handleChatCompletionFeedbackSubmission({
				request,
				env: mockEnv,
				user: mockUser,
				completion_id: completionId,
			});

			expect(result).toHaveProperty("success");
			expect(result).toHaveProperty("message");
			expect(result).toHaveProperty("completion_id");
			expect(typeof result.success).toBe("boolean");
			expect(typeof result.message).toBe("string");
			expect(typeof result.completion_id).toBe("string");
			expect(result.success).toBe(true);
			expect(result.message).toBe("Feedback submitted successfully");
			expect(result.completion_id).toBe(completionId);
		});
	});
});
