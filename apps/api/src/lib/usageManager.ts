import { USAGE_CONFIG } from "~/constants/app";
import { RepositoryManager } from "~/repositories";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { AnonymousUser, ModelConfigItem, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { memoizeRequest, type RequestCache } from "~/utils/requestCache";

const logger = getLogger({ prefix: "lib/usageManager" });

export type UsageUpdateTaskInput =
	| {
			action: "increment_usage";
			userId: number;
	  }
	| {
			action: "increment_pro_usage";
			userId: number;
			modelId?: string;
			usageMultiplier: number;
	  }
	| {
			action: "increment_anonymous_usage";
			anonymousUserId: string;
	  }
	| {
			action: "increment_function_usage";
			userId: number;
			functionType: "premium" | "normal";
			isProUser: boolean;
			costPerCall: number;
	  };

export type UsageUpdateTaskPayload = UsageUpdateTaskInput & {
	queuedAt: number;
};

type UsageTaskEnqueuer = (payload: UsageUpdateTaskPayload) => Promise<void>;

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
	private enqueueUsageTask?: UsageTaskEnqueuer;
	private asyncUsageUpdates: boolean;
	private regularUsageSnapshot?: { dailyCount: number; limit: number };
	private proUsageSnapshot?: { dailyCount: number; limit: number };

	constructor(
		repositories: RepositoryManager,
		user: User | null,
		anonymousUser: AnonymousUser | null,
		options?: {
			requestCache?: RequestCache;
			enqueueUsageTask?: UsageTaskEnqueuer;
			asyncUsageUpdates?: boolean;
		},
	) {
		this.repositories = repositories;
		this.user = user;
		this.anonymousUser = anonymousUser;
		this.requestCache = options?.requestCache;
		this.enqueueUsageTask = options?.enqueueUsageTask;
		this.asyncUsageUpdates =
			options?.asyncUsageUpdates ?? Boolean(options?.enqueueUsageTask);
	}

	private isNewUtcDay(now: Date, lastReset: Date | null): boolean {
		return (
			!lastReset ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCDate() !== lastReset.getUTCDate()
		);
	}

	private getRegularUsageSnapshot(): { dailyCount: number; limit: number } {
		if (!this.user?.id) {
			throw new AssistantError(
				"User required to check authenticated usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (this.regularUsageSnapshot) {
			return this.regularUsageSnapshot;
		}

		const now = new Date();
		const lastReset = this.user.daily_reset
			? new Date(this.user.daily_reset)
			: null;
		const isNewDay = this.isNewUtcDay(now, lastReset);
		const dailyCount = isNewDay ? 0 : (this.user.daily_message_count ?? 0);

		if (isNewDay) {
			this.user.daily_message_count = 0;
			this.user.daily_reset = now.toISOString();
		}

		this.regularUsageSnapshot = {
			dailyCount,
			limit: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
		};

		return this.regularUsageSnapshot;
	}

	private getProUsageSnapshot(): { dailyCount: number; limit: number } {
		if (!this.user?.id) {
			throw new AssistantError(
				"User required to check pro usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (this.proUsageSnapshot) {
			return this.proUsageSnapshot;
		}

		const now = new Date();
		const lastReset = this.user.daily_pro_reset
			? new Date(this.user.daily_pro_reset)
			: null;
		const isNewDay = this.isNewUtcDay(now, lastReset);
		const dailyCount = isNewDay ? 0 : (this.user.daily_pro_message_count ?? 0);

		if (isNewDay) {
			this.user.daily_pro_message_count = 0;
			this.user.daily_pro_reset = now.toISOString();
		}

		this.proUsageSnapshot = {
			dailyCount,
			limit: USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS,
		};

		return this.proUsageSnapshot;
	}

	private invalidateRegularUsageSnapshot() {
		this.regularUsageSnapshot = undefined;
	}

	private invalidateProUsageSnapshot() {
		this.proUsageSnapshot = undefined;
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
			logger.debug("Calculating function usage multiplier", { modelId });
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
		const snapshot = this.getRegularUsageSnapshot();

		logger.debug("Checking usage limits", { userId: this.user?.id });

		if (snapshot.dailyCount >= snapshot.limit) {
			throw new AssistantError(
				"Daily message limit for authenticated users reached.",
				ErrorType.USAGE_LIMIT_ERROR,
			);
		}

		logger.debug("Usage limits checked", { userId: this.user?.id });

		return {
			dailyCount: snapshot.dailyCount,
			dailyLimit: snapshot.limit,
		};
	}

	async incrementUsage() {
		if (!this.user?.id) {
			throw new AssistantError(
				"User required to increment authenticated usage",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Incrementing usage", { userId: this.user.id });

		if (
			await this.tryEnqueueUsageTask({
				action: "increment_usage",
				userId: this.user.id,
			})
		) {
			this.incrementLocalCounts(["message_count", "daily_message_count"]);
			return;
		}

		try {
			const updatedUser = await UsageManager.applyAuthenticatedUsageUpdate(
				this.repositories,
				this.user,
			);
			this.user = updatedUser;
			this.invalidateRegularUsageSnapshot();
		} catch (error) {
			logger.error("Failed to update usage data", {
				error,
				userId: this.user.id,
			});
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

		if (
			await this.tryEnqueueUsageTask({
				action: "increment_anonymous_usage",
				anonymousUserId: this.anonymousUser.id,
			})
		) {
			return;
		}

		await UsageManager.applyAnonymousUsageUpdate(
			this.repositories,
			this.anonymousUser.id,
		);

		logger.debug("Anonymous usage incremented", {
			anonymousUserId: this.anonymousUser.id,
		});
	}

	async checkProUsage(modelId: string) {
		logger.debug("Checking pro usage", { modelId });

		const snapshot = this.getProUsageSnapshot();
		const usageMultiplier = await this.calculateUsageMultiplier(modelId);
		const dailyProCount = snapshot.dailyCount;

		if (dailyProCount >= snapshot.limit) {
			throw new AssistantError(
				"Daily Pro model limit reached.",
				ErrorType.USAGE_LIMIT_ERROR,
			);
		}

		const modelConfig = await this.getModelConfig(modelId);

		logger.debug("Pro usage checked", { userId: this.user.id });

		return {
			dailyProCount,
			limit: snapshot.limit,
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

		if (
			await this.tryEnqueueUsageTask({
				action: "increment_pro_usage",
				userId: this.user.id,
				modelId,
				usageMultiplier,
			})
		) {
			this.incrementLocalCounts(["message_count"]);
			this.incrementLocalCounts(["daily_pro_message_count"], usageMultiplier);
			return;
		}

		const updatedUser = await UsageManager.applyProUsageUpdate(
			this.repositories,
			this.user,
			usageMultiplier,
		);
		this.user = updatedUser;
		this.invalidateProUsageSnapshot();

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

		const regularSnapshot = this.getRegularUsageSnapshot();

		const usageLimits: UsageLimits = {
			daily: {
				used: regularSnapshot.dailyCount,
				limit: regularSnapshot.limit,
			},
		};

		if (this.user.plan_id === "pro") {
			const proSnapshot = this.getProUsageSnapshot();
			usageLimits.pro = {
				used: proSnapshot.dailyCount,
				limit: proSnapshot.limit,
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

		if (
			await this.tryEnqueueUsageTask({
				action: "increment_function_usage",
				userId: this.user.id,
				functionType,
				isProUser: isPro,
				costPerCall,
			})
		) {
			this.incrementLocalCounts(["daily_message_count"]);
			if (functionType === "premium") {
				this.incrementLocalCounts(["daily_pro_message_count"], costPerCall);
			}
			return;
		}

		const updatedUser = await UsageManager.applyFunctionUsageUpdate(
			this.repositories,
			this.user,
			{ functionType, isPro, costPerCall },
		);
		this.user = updatedUser;
		this.invalidateRegularUsageSnapshot();
		this.invalidateProUsageSnapshot();

		logger.debug("Function usage incremented", { userId: this.user.id });
	}

	private incrementLocalCounts(fields: Array<keyof User>, increment = 1): void {
		if (!this.user) return;
		for (const field of fields) {
			const current = Number(this.user[field] ?? 0);
			(this.user as any)[field] = current + increment;

			if (field === "daily_message_count" && this.regularUsageSnapshot) {
				this.regularUsageSnapshot.dailyCount += increment;
			}

			if (field === "daily_pro_message_count" && this.proUsageSnapshot) {
				this.proUsageSnapshot.dailyCount += increment;
			}
		}
		this.user.last_active_at = new Date().toISOString();
	}

	private async tryEnqueueUsageTask(
		payload: UsageUpdateTaskInput,
	): Promise<boolean> {
		if (!this.shouldEnqueueUsage()) {
			return false;
		}

		try {
			const enrichedPayload: UsageUpdateTaskPayload = {
				...payload,
				queuedAt: Date.now(),
			};

			await this.enqueueUsageTask!(enrichedPayload);
			return true;
		} catch (error) {
			logger.error("Failed to enqueue usage task", { error, payload });
			return false;
		}
	}

	private shouldEnqueueUsage(): boolean {
		return Boolean(this.enqueueUsageTask && this.asyncUsageUpdates);
	}

	public static async applyAuthenticatedUsageUpdate(
		repositories: RepositoryManager,
		user: User,
	): Promise<User> {
		const now = new Date();
		const lastReset = user.daily_reset ? new Date(user.daily_reset) : null;
		const isNewDay =
			!lastReset ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCDate() !== lastReset.getUTCDate();

		const currentDailyCount = isNewDay ? 0 : (user.daily_message_count ?? 0);
		const updates: Partial<User> & Record<string, any> = {
			message_count: (user.message_count ?? 0) + 1,
			daily_message_count: currentDailyCount + 1,
			last_active_at: now.toISOString(),
			...(isNewDay && { daily_reset: now.toISOString() }),
		};

		await repositories.users.updateUser(user.id, updates);

		return {
			...user,
			...updates,
		};
	}

	public static async applyProUsageUpdate(
		repositories: RepositoryManager,
		user: User,
		usageMultiplier: number,
	): Promise<User> {
		const now = new Date();
		const lastReset = user.daily_pro_reset
			? new Date(user.daily_pro_reset)
			: null;
		const isNewDay =
			!lastReset ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCDate() !== lastReset.getUTCDate();

		const currentDailyCount = isNewDay
			? 0
			: (user.daily_pro_message_count ?? 0);

		const updates: Partial<User> & Record<string, any> = {
			message_count: (user.message_count ?? 0) + 1,
			daily_pro_message_count: currentDailyCount + usageMultiplier,
			last_active_at: now.toISOString(),
			...(isNewDay && { daily_pro_reset: now.toISOString() }),
		};

		await repositories.users.updateUser(user.id, updates);

		return {
			...user,
			...updates,
		};
	}

	public static async applyAnonymousUsageUpdate(
		repositories: RepositoryManager,
		anonymousUserId: string,
	): Promise<void> {
		await repositories.anonymousUsers.incrementDailyCount(anonymousUserId);
	}

	public static async applyFunctionUsageUpdate(
		repositories: RepositoryManager,
		user: User,
		options: {
			functionType: "premium" | "normal";
			isPro: boolean;
			costPerCall: number;
		},
	): Promise<User> {
		if (options.functionType === "premium" && !options.isPro) {
			throw new AssistantError(
				"You are not a paid user. Please upgrade to a paid plan to use premium functions.",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const updates: Partial<User> & Record<string, any> = {
			daily_message_count: (user.daily_message_count ?? 0) + 1,
			message_count: (user.message_count ?? 0) + 1,
			last_active_at: new Date().toISOString(),
		};

		if (options.functionType === "premium") {
			updates.daily_pro_message_count =
				(user.daily_pro_message_count ?? 0) + options.costPerCall;
		}

		await repositories.users.updateUser(user.id, updates);

		return {
			...user,
			...updates,
		};
	}
}
