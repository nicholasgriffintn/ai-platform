import { USAGE_CONFIG } from "~/constants/app";
import { RepositoryManager } from "~/repositories";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { AnonymousUser, ModelConfigItem, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { memoizeRequest, type RequestCache } from "~/utils/requestCache";

const logger = getLogger({ prefix: "lib/usageManager" });

export interface UsageLimits {
	daily: {
		used: number;
		limit: number;
	};
	pro?: {
		used: number;
		limit: number;
	};
}

export class UsageManager {
	private repositories: RepositoryManager;
	private user: User | null;
	private anonymousUser: AnonymousUser | null;
	private requestCache?: RequestCache;

	constructor(
		repositories: RepositoryManager,
		user: User | null,
		anonymousUser: AnonymousUser | null,
		requestCache?: RequestCache,
	) {
		this.repositories = repositories;
		this.user = user;
		this.anonymousUser = anonymousUser;
		this.requestCache = requestCache;
	}

	private memoize<T>(key: string, factory: () => Promise<T>): Promise<T> {
		return memoizeRequest(this.requestCache, key, factory);
	}

	private async getModelConfig(
		modelId: string,
	): Promise<ModelConfigItem | undefined> {
		return this.memoize(`usage:model-config:${modelId}`, () =>
			getModelConfigByMatchingModel(modelId),
		);
	}

	private async isProModel(modelId: string): Promise<boolean> {
		const config = await this.getModelConfig(modelId);
		return !!config && config.isFree !== true;
	}

	private async calculateUsageMultiplier(modelId: string): Promise<number> {
		return this.memoize(`usage:model-multiplier:${modelId}`, async () => {
			logger.debug("Calculating usage multiplier", { modelId });
			const config = await this.getModelConfig(modelId);
			if (!config) {
				logger.warn(
					`No config found for model: ${modelId}, using default multiplier: 1`,
				);
				return 1;
			}

			if (!config.costPer1kInputTokens && !config.costPer1kOutputTokens) {
				logger.warn(
					`No cost data for model: ${modelId}, using default multiplier: 1`,
				);
				return 1;
			}

			const inputMultiplier =
				(config.costPer1kInputTokens || 0) / USAGE_CONFIG.BASELINE_INPUT_COST;
			const outputMultiplier =
				(config.costPer1kOutputTokens || 0) / USAGE_CONFIG.BASELINE_OUTPUT_COST;
			const avgMultiplier = (inputMultiplier + outputMultiplier) / 2;
			const finalMultiplier = Math.ceil(avgMultiplier);

			logger.debug(`Model: ${modelId} calculation:`, {
				inputCost: config.costPer1kInputTokens,
				outputCost: config.costPer1kOutputTokens,
				inputMultiplier,
				outputMultiplier,
				avgMultiplier,
				finalMultiplier,
			});

			return finalMultiplier;
		});
	}

	async checkUsage() {
		if (!this.user?.id) {
			throw new AssistantError(
				"User required to check authenticated usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Checking usage limits", { userId: this.user.id });

		const dailyLimit = USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT;

		const now = new Date();
		let dailyCount = this.user.daily_message_count ?? 0;
		const lastReset = this.user.daily_reset
			? new Date(this.user.daily_reset)
			: null;
		let needsUpdate = false;
		const updates: Partial<User> & Record<string, any> = {};

		const isNewDay =
			!lastReset ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCDate() !== lastReset.getUTCDate();

		if (isNewDay) {
			dailyCount = 0;
			updates.daily_message_count = 0;
			updates.daily_reset = now.toISOString();
			needsUpdate = true;
		}

		if (needsUpdate) {
			try {
				await this.repositories.users.updateUser(this.user.id, updates);
			} catch (resetError) {
				logger.error("Failed to reset daily count", { error: resetError });
				throw new AssistantError(
					"Failed to reset daily count",
					ErrorType.INTERNAL_ERROR,
				);
			}
		}

		if (dailyCount >= dailyLimit) {
			throw new AssistantError(
				"Daily message limit for authenticated users reached.",
				ErrorType.USAGE_LIMIT_ERROR,
			);
		}

		logger.debug("Usage limits checked", { userId: this.user.id });

		return { dailyCount, dailyLimit };
	}

	async incrementUsage() {
		if (!this.user?.id) {
			throw new AssistantError(
				"User required to increment authenticated usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Incrementing usage", { userId: this.user.id });

		const messageCount = this.user.message_count ?? 0;
		const dailyCount = this.user.daily_message_count ?? 0;

		const now = new Date();
		const lastReset = this.user.daily_reset
			? new Date(this.user.daily_reset)
			: null;
		const isNewDay =
			!lastReset ||
			now.getUTCDate() !== lastReset.getUTCDate() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear();
		const currentDailyCount = isNewDay ? 0 : dailyCount;

		const updates = {
			message_count: messageCount + 1,
			daily_message_count: currentDailyCount + 1,
			last_active_at: now.toISOString(),
			...(isNewDay && { daily_reset: now.toISOString() }),
		};

		try {
			await this.repositories.users.updateUser(this.user.id, updates);
		} catch (updateError) {
			logger.error("Failed to update usage data", { error: updateError });
			throw new AssistantError(
				"Failed to update usage data",
				ErrorType.INTERNAL_ERROR,
			);
		}

		logger.debug("Usage incremented", { userId: this.user.id });
	}

	async checkAnonymousUsage() {
		if (!this.anonymousUser?.id) {
			throw new AssistantError(
				"Anonymous user required to check anonymous usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Checking anonymous usage limits", {
			anonymousUserId: this.anonymousUser.id,
		});

		const dailyLimit = USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT;
		const { count: dailyCount } =
			await this.repositories.anonymousUsers.checkAndResetDailyLimit(
				this.anonymousUser.id,
			);

		if (dailyCount >= dailyLimit) {
			throw new AssistantError(
				"Daily message limit for anonymous users reached. Please log in for higher limits.",
				ErrorType.USAGE_LIMIT_ERROR,
			);
		}

		logger.debug("Anonymous usage limits checked", {
			anonymousUserId: this.anonymousUser.id,
		});

		return { dailyCount, dailyLimit };
	}

	async incrementAnonymousUsage() {
		if (!this.anonymousUser?.id) {
			throw new AssistantError(
				"Anonymous user required to increment anonymous usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Incrementing anonymous usage", {
			anonymousUserId: this.anonymousUser.id,
		});

		await this.repositories.anonymousUsers.incrementDailyCount(
			this.anonymousUser.id,
		);

		logger.debug("Anonymous usage incremented", {
			anonymousUserId: this.anonymousUser.id,
		});
	}

	async checkProUsage(modelId: string) {
		if (!this.user?.id) {
			throw new AssistantError(
				"User required to check pro usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Calculating usage multiplier", { modelId });

		const usageMultiplier = await this.calculateUsageMultiplier(modelId);

		let dailyProCount = this.user.daily_pro_message_count || 0;
		const now = new Date();
		const lastReset = this.user.daily_pro_reset
			? new Date(this.user.daily_pro_reset)
			: null;
		let needsUpdate = false;
		const updates: Partial<User> & Record<string, any> = {};

		const isNewDay =
			!lastReset ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCDate() !== lastReset.getUTCDate();

		if (isNewDay) {
			dailyProCount = 0;
			updates.daily_pro_message_count = 0;
			updates.daily_pro_reset = now.toISOString();
			needsUpdate = true;
		}

		if (needsUpdate) {
			try {
				await this.repositories.users.updateUser(this.user.id, updates);
			} catch (resetError) {
				logger.error("Failed to reset pro usage", { error: resetError });
				throw new AssistantError(
					"Failed to reset pro usage",
					ErrorType.INTERNAL_ERROR,
				);
			}
		}

		if (dailyProCount >= USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS) {
			throw new AssistantError(
				"Daily Pro model limit reached.",
				ErrorType.USAGE_LIMIT_ERROR,
			);
		}

		const modelConfig = await this.getModelConfig(modelId);

		logger.debug("Pro usage checked", { userId: this.user.id });

		return {
			dailyProCount,
			limit: USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS,
			costMultiplier: usageMultiplier,
			modelCostInfo: {
				inputCost: modelConfig?.costPer1kInputTokens || 0,
				outputCost: modelConfig?.costPer1kOutputTokens || 0,
			},
		};
	}

	async incrementProUsage(modelId: string) {
		if (!this.user?.id) {
			throw new AssistantError(
				"User required to increment pro usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Incrementing pro usage", { userId: this.user.id });

		const usageMultiplier = await this.calculateUsageMultiplier(modelId);

		const count = this.user.daily_pro_message_count ?? 0;
		const messageCount = this.user.message_count ?? 0;

		const now = new Date();
		const lastReset = this.user.daily_pro_reset
			? new Date(this.user.daily_pro_reset)
			: null;
		const isNewDay =
			!lastReset ||
			now.getUTCDate() !== lastReset.getUTCDate() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear();
		const currentDailyCount = isNewDay ? 0 : count;

		const updatedCount = currentDailyCount + usageMultiplier;

		const updates = {
			message_count: messageCount + 1,
			daily_pro_message_count: updatedCount,
			last_active_at: new Date().toISOString(),
			...(isNewDay && { daily_pro_reset: now.toISOString() }),
		};

		try {
			await this.repositories.users.updateUser(this.user.id, updates);
		} catch (updateError) {
			logger.error("Failed to increment pro usage", { error: updateError });
			throw new AssistantError(
				"Failed to increment pro usage",
				ErrorType.INTERNAL_ERROR,
			);
		}

		logger.debug("Pro usage incremented", { userId: this.user.id });
	}

	async checkUsageByModel(modelId: string, isPro: boolean) {
		logger.debug("Checking usage by model", { modelId, isPro });
		const modelIsPro = await this.isProModel(modelId);

		if (modelIsPro) {
			if (!isPro) {
				throw new AssistantError(
					"You are not a paid user. Please upgrade to a paid plan to use this model.",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			return await this.checkProUsage(modelId);
		}

		if (this.user?.id) {
			return await this.checkUsage();
		}

		if (this.anonymousUser?.id) {
			return await this.checkAnonymousUsage();
		}

		throw new AssistantError(
			"Either authenticated or anonymous user required for usage tracking",
			ErrorType.PARAMS_ERROR,
		);
	}

	async incrementUsageByModel(modelId: string, isPro: boolean) {
		logger.debug("Incrementing usage by model", { modelId, isPro });
		const modelIsPro = await this.isProModel(modelId);

		if (modelIsPro) {
			if (isPro) {
				await this.incrementProUsage(modelId);
			} else {
				throw new AssistantError(
					"You are not a paid user. Please upgrade to a paid plan to use this model.",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}
		} else if (this.user?.id) {
			await this.incrementUsage();
		} else if (this.anonymousUser?.id) {
			await this.incrementAnonymousUsage();
		} else {
			throw new AssistantError(
				"Either authenticated or anonymous user required for usage tracking",
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	/**
	 * Get usage limit information for a user
	 * @returns UsageLimits object with information about regular and pro limits
	 */
	async getUsageLimits(): Promise<UsageLimits> {
		logger.debug("Fetching usage limits");
		if (!this.user?.id) {
			if (this.anonymousUser?.id) {
				const { count: dailyCount } =
					await this.repositories.anonymousUsers.checkAndResetDailyLimit(
						this.anonymousUser.id,
					);

				return {
					daily: {
						used: dailyCount,
						limit: USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT,
					},
				};
			}

			throw new AssistantError(
				"User required to get usage limits",
				ErrorType.PARAMS_ERROR,
			);
		}

		const now = new Date();
		let regularDailyCount = this.user.daily_message_count ?? 0;
		let proDailyCount = this.user.daily_pro_message_count ?? 0;

		const lastReset = this.user.daily_reset
			? new Date(this.user.daily_reset)
			: null;
		const isNewRegularDay =
			!lastReset ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCDate() !== lastReset.getUTCDate();

		if (isNewRegularDay) {
			regularDailyCount = 0;
		}

		const lastProReset = this.user.daily_pro_reset
			? new Date(this.user.daily_pro_reset)
			: null;
		const isNewProDay =
			!lastProReset ||
			now.getUTCFullYear() !== lastProReset.getUTCFullYear() ||
			now.getUTCMonth() !== lastProReset.getUTCMonth() ||
			now.getUTCDate() !== lastProReset.getUTCDate();

		if (isNewProDay) {
			proDailyCount = 0;
		}

		const usageLimits: UsageLimits = {
			daily: {
				used: regularDailyCount,
				limit: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
			},
		};

		if (this.user.plan_id === "pro") {
			usageLimits.pro = {
				used: proDailyCount,
				limit: USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS,
			};
		}

		logger.debug("Usage limits fetched", { userId: this.user.id });

		return usageLimits;
	}

	/**
	 * Get the cost multiplier for a specific model
	 * @param modelId The ID of the model to check
	 * @returns The cost multiplier for the model
	 */
	async getModelUsageMultiplier(modelId: string): Promise<{
		multiplier: number;
		modelCostInfo: {
			inputCost: number;
			outputCost: number;
		};
	}> {
		logger.debug("Getting model usage multiplier", { modelId });
		const usageMultiplier = await this.calculateUsageMultiplier(modelId);
		const modelConfig = await this.getModelConfig(modelId);

		logger.debug("Model config fetched", { modelId, modelConfig });

		return {
			multiplier: usageMultiplier,
			modelCostInfo: {
				inputCost: modelConfig?.costPer1kInputTokens || 0,
				outputCost: modelConfig?.costPer1kOutputTokens || 0,
			},
		};
	}

	async incrementFunctionUsage(
		functionType: "premium" | "normal",
		isPro: boolean,
		costPerCall = 1,
	) {
		if (!costPerCall) {
			return;
		}

		if (!this.user?.id) {
			throw new AssistantError(
				"User required to increment function usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Incrementing function usage", {
			userId: this.user.id,
			functionType,
		});

		const dailyCount = this.user.daily_message_count ?? 0;
		const dailyProCount = this.user.daily_pro_message_count ?? 0;

		const updates: Partial<User> & Record<string, any> = {
			daily_message_count: dailyCount + 1,
		};

		if (functionType === "premium") {
			if (!isPro) {
				throw new AssistantError(
					"You are not a paid user. Please upgrade to a paid plan to use premium functions.",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}
			updates.daily_pro_message_count = dailyProCount + costPerCall;
		}

		try {
			await this.repositories.users.updateUser(this.user.id, updates);
		} catch (updateError) {
			logger.error("Failed to update function usage data", {
				error: updateError,
			});
			throw new AssistantError(
				"Failed to update function usage data",
				ErrorType.INTERNAL_ERROR,
			);
		}

		logger.debug("Function usage incremented", { userId: this.user.id });
	}
}
