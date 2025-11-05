import { beforeEach, describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { UsageManager } from "../usageManager";

const mockRepositories = {
	users: {
		updateUser: vi.fn(),
	},
	anonymousUsers: {
		checkAndResetAnonymousUserDailyLimit: vi.fn(),
		incrementAnonymousUserDailyCount: vi.fn(),
	},
};

vi.mock("~/lib/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/constants/app", () => ({
	USAGE_CONFIG: {
		AUTH_DAILY_MESSAGE_LIMIT: 25,
		NON_AUTH_DAILY_MESSAGE_LIMIT: 5,
		DAILY_LIMIT_PRO_MODELS: 50,
		BASELINE_INPUT_COST: 0.0005,
		BASELINE_OUTPUT_COST: 0.0015,
	},
}));

describe("UsageManager", () => {
	const mockUser = {
		id: 1,
		email: "test@example.com",
		plan_id: "free",
		daily_message_count: 10,
		daily_reset: new Date().toISOString(),
		daily_pro_message_count: 5,
		daily_pro_reset: new Date().toISOString(),
		message_count: 100,
	} as any;

	const mockAnonymousUser = {
		id: "anon-123",
	} as any;

	let usageManager: UsageManager;

	beforeEach(() => {
		vi.clearAllMocks();
		usageManager = new UsageManager(mockRepositories as any, mockUser, null);
	});

	describe("checkUsage", () => {
		it("should check usage for authenticated user", async () => {
			const result = await usageManager.checkUsage();

			expect(result).toEqual({
				dailyCount: 10,
				dailyLimit: 25,
			});
		});

		it("should reset daily count when new day", async () => {
			const userWithOldReset = {
				...mockUser,
				daily_reset: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				daily_message_count: 20,
			};

			const managerWithOldUser = new UsageManager(
				mockDatabase as any,
				userWithOldReset,
				null,
			);

			mockRepositories.users.updateUser.mockResolvedValue(undefined);

			const result = await managerWithOldUser.checkUsage();

			expect(result.dailyCount).toBe(0);
			expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(
				userWithOldReset.id,
				expect.objectContaining({
					daily_message_count: 0,
					daily_reset: expect.any(String),
				}),
			);
		});

		it("should throw error when daily limit reached", async () => {
			const userAtLimit = {
				...mockUser,
				daily_message_count: 25,
			};

			const managerAtLimit = new UsageManager(
				mockDatabase as any,
				userAtLimit,
				null,
			);

			await expect(managerAtLimit.checkUsage()).rejects.toThrow(
				"Daily message limit for authenticated users reached.",
			);
		});

		it("should throw error when no user ID", async () => {
			const managerNoUser = new UsageManager(mockRepositories as any, null, null);

			await expect(managerNoUser.checkUsage()).rejects.toThrow(
				"User required to check authenticated usage",
			);
		});
	});

	describe("incrementUsage", () => {
		it("should increment usage for authenticated user", async () => {
			mockRepositories.users.updateUser.mockResolvedValue(undefined);

			await usageManager.incrementUsage();

			expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({
					message_count: 101,
					daily_message_count: 11,
					last_active_at: expect.any(String),
				}),
			);
		});

		it("should reset daily count on new day during increment", async () => {
			const userWithOldReset = {
				...mockUser,
				daily_reset: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				daily_message_count: 20,
			};

			const managerWithOldUser = new UsageManager(
				mockDatabase as any,
				userWithOldReset,
				null,
			);

			mockRepositories.users.updateUser.mockResolvedValue(undefined);

			await managerWithOldUser.incrementUsage();

			expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(
				userWithOldReset.id,
				expect.objectContaining({
					daily_message_count: 1,
					daily_reset: expect.any(String),
				}),
			);
		});

		it("should throw error when no user ID", async () => {
			const managerNoUser = new UsageManager(mockRepositories as any, null, null);

			await expect(managerNoUser.incrementUsage()).rejects.toThrow(
				"User required to increment authenticated usage",
			);
		});
	});

	describe("checkAnonymousUsage", () => {
		it("should check usage for anonymous user", async () => {
			const managerAnonymous = new UsageManager(
				mockDatabase as any,
				null,
				mockAnonymousUser,
			);

			mockRepositories.anonymousUsers.checkAndResetAnonymousUserDailyLimit.mockResolvedValue({
				count: 3,
			});

			const result = await managerAnonymous.checkAnonymousUsage();

			expect(result).toEqual({
				dailyCount: 3,
				dailyLimit: 5,
			});
		});

		it("should throw error when anonymous limit reached", async () => {
			const managerAnonymous = new UsageManager(
				mockDatabase as any,
				null,
				mockAnonymousUser,
			);

			mockRepositories.anonymousUsers.checkAndResetAnonymousUserDailyLimit.mockResolvedValue({
				count: 5,
			});

			await expect(managerAnonymous.checkAnonymousUsage()).rejects.toThrow(
				"Daily message limit for anonymous users reached. Please log in for higher limits.",
			);
		});

		it("should throw error when no anonymous user ID", async () => {
			const managerNoAnonymous = new UsageManager(
				mockDatabase as any,
				null,
				null,
			);

			await expect(managerNoAnonymous.checkAnonymousUsage()).rejects.toThrow(
				"Anonymous user required to check anonymous usage",
			);
		});
	});

	describe("checkProUsage", () => {
		it("should check pro usage for model", async () => {
			(getModelConfigByMatchingModel as any).mockResolvedValue({
				costPer1kInputTokens: 0.001,
				costPer1kOutputTokens: 0.003,
			});

			const result = await usageManager.checkProUsage("gpt-4");

			expect(result).toEqual({
				dailyProCount: 5,
				limit: 50,
				costMultiplier: expect.any(Number),
				modelCostInfo: {
					inputCost: 0.001,
					outputCost: 0.003,
				},
			});
		});

		it("should reset pro count on new day", async () => {
			const userWithOldProReset = {
				...mockUser,
				daily_pro_reset: new Date(
					Date.now() - 24 * 60 * 60 * 1000,
				).toISOString(),
				daily_pro_message_count: 30,
			};

			const managerOldProReset = new UsageManager(
				mockDatabase as any,
				userWithOldProReset,
				null,
			);

			(getModelConfigByMatchingModel as any).mockResolvedValue({
				costPer1kInputTokens: 0.001,
				costPer1kOutputTokens: 0.003,
			});

			mockRepositories.users.updateUser.mockResolvedValue(undefined);

			const result = await managerOldProReset.checkProUsage("gpt-4");

			expect(result.dailyProCount).toBe(0);
			expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(
				userWithOldProReset.id,
				expect.objectContaining({
					daily_pro_message_count: 0,
					daily_pro_reset: expect.any(String),
				}),
			);
		});

		it("should throw error when pro limit reached", async () => {
			const userAtProLimit = {
				...mockUser,
				daily_pro_message_count: 50,
			};

			const managerAtProLimit = new UsageManager(
				mockDatabase as any,
				userAtProLimit,
				null,
			);

			(getModelConfigByMatchingModel as any).mockResolvedValue({
				costPer1kInputTokens: 0.001,
				costPer1kOutputTokens: 0.003,
			});

			await expect(managerAtProLimit.checkProUsage("gpt-4")).rejects.toThrow(
				"Daily Pro model limit reached.",
			);
		});
	});

	describe("checkUsageByModel", () => {
		it("should check regular model usage for free user", async () => {
			(getModelConfigByMatchingModel as any).mockResolvedValue({
				isFree: true,
			});

			const result = await usageManager.checkUsageByModel(
				"gpt-3.5-turbo",
				false,
			);

			expect(result).toEqual({
				dailyCount: 10,
				dailyLimit: 25,
			});
		});

		it("should throw error for pro model with free user", async () => {
			(getModelConfigByMatchingModel as any).mockResolvedValue({
				isFree: false,
			});

			await expect(
				usageManager.checkUsageByModel("gpt-4", false),
			).rejects.toThrow(
				"You are not a paid user. Please upgrade to a paid plan to use this model.",
			);
		});

		it("should check pro model usage for pro user", async () => {
			(getModelConfigByMatchingModel as any).mockResolvedValue({
				isFree: false,
				costPer1kInputTokens: 0.001,
				costPer1kOutputTokens: 0.003,
			});

			const result = await usageManager.checkUsageByModel("gpt-4", true);

			expect(result).toEqual({
				dailyProCount: 5,
				limit: 50,
				costMultiplier: expect.any(Number),
				modelCostInfo: {
					inputCost: 0.001,
					outputCost: 0.003,
				},
			});
		});
	});

	describe("getUsageLimits", () => {
		it("should return usage limits for authenticated user", async () => {
			const result = await usageManager.getUsageLimits();

			expect(result).toEqual({
				daily: {
					used: 10,
					limit: 25,
				},
			});
		});

		it("should include pro limits for pro user", async () => {
			const proUser = {
				...mockUser,
				plan_id: "pro",
			};

			const proUsageManager = new UsageManager(
				mockDatabase as any,
				proUser,
				null,
			);

			const result = await proUsageManager.getUsageLimits();

			expect(result).toEqual({
				daily: {
					used: 10,
					limit: 25,
				},
				pro: {
					used: 5,
					limit: 50,
				},
			});
		});

		it("should return anonymous limits for anonymous user", async () => {
			const anonymousManager = new UsageManager(
				mockDatabase as any,
				null,
				mockAnonymousUser,
			);

			mockRepositories.anonymousUsers.checkAndResetAnonymousUserDailyLimit.mockResolvedValue({
				count: 3,
			});

			const result = await anonymousManager.getUsageLimits();

			expect(result).toEqual({
				daily: {
					used: 3,
					limit: 5,
				},
			});
		});

		it("should throw error when no user", async () => {
			const noUserManager = new UsageManager(mockRepositories as any, null, null);

			await expect(noUserManager.getUsageLimits()).rejects.toThrow(
				"User required to get usage limits",
			);
		});
	});

	describe("incrementFunctionUsage", () => {
		it("should increment normal function usage", async () => {
			mockRepositories.users.updateUser.mockResolvedValue(undefined);

			await usageManager.incrementFunctionUsage("normal", false, 1);

			expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({
					daily_message_count: 11,
				}),
			);
		});

		it("should increment premium function usage for pro user", async () => {
			mockRepositories.users.updateUser.mockResolvedValue(undefined);

			await usageManager.incrementFunctionUsage("premium", true, 2);

			expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({
					daily_message_count: 11,
					daily_pro_message_count: 7,
				}),
			);
		});

		it("should throw error for premium function with free user", async () => {
			await expect(
				usageManager.incrementFunctionUsage("premium", false, 1),
			).rejects.toThrow(
				"You are not a paid user. Please upgrade to a paid plan to use premium functions.",
			);
		});

		it("should skip when cost is zero", async () => {
			await usageManager.incrementFunctionUsage("normal", false, 0);

			expect(mockRepositories.users.updateUser).not.toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("should handle database update errors", async () => {
			mockRepositories.users.updateUser.mockRejectedValue(new Error("Database error"));

			await expect(usageManager.incrementUsage()).rejects.toThrow(
				"Failed to update usage data",
			);
		});

		it("should handle anonymous database errors", async () => {
			const anonymousManager = new UsageManager(
				mockDatabase as any,
				null,
				mockAnonymousUser,
			);

			mockRepositories.anonymousUsers.checkAndResetAnonymousUserDailyLimit.mockRejectedValue(
				new Error("Database error"),
			);

			await expect(anonymousManager.checkAnonymousUsage()).rejects.toThrow(
				"Database error",
			);
		});
	});
});
