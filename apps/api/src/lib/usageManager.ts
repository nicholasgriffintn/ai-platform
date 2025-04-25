import type { Database } from "~/lib/database";
import { getModelConfigByMatchingModel } from "~/lib/models";
import type { ModelConfigItem } from "~/types";
import type { User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "USAGE_MANAGER" });

// TODO: Define these limits in a central config or env vars
const NON_AUTH_DAILY_MESSAGE_LIMIT = 10;
const AUTH_DAILY_MESSAGE_LIMIT = 50;
const DAILY_LIMIT_PRO_MODELS = 100;

const BASELINE_INPUT_COST = 0.0025;
const BASELINE_OUTPUT_COST = 0.01;

function isProModel(modelId: string): boolean {
  const config: ModelConfigItem | undefined =
    getModelConfigByMatchingModel(modelId);
  return !!config && config.isFree !== true;
}

function calculateUsageMultiplier(modelId: string): number {
  const config = getModelConfigByMatchingModel(modelId);
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
    (config.costPer1kInputTokens || 0) / BASELINE_INPUT_COST;
  const outputMultiplier =
    (config.costPer1kOutputTokens || 0) / BASELINE_OUTPUT_COST;
  const avgMultiplier = (inputMultiplier + outputMultiplier) / 2;
  const finalMultiplier = Math.ceil(avgMultiplier);

  logger.info(`Model: ${modelId} calculation:`, {
    inputCost: config.costPer1kInputTokens,
    outputCost: config.costPer1kOutputTokens,
    inputMultiplier,
    outputMultiplier,
    avgMultiplier,
    finalMultiplier,
  });

  return finalMultiplier;
}

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
  private database: Database;
  private userId: User["id"];

  constructor(database: Database, userId: User["id"]) {
    this.database = database;
    this.userId = userId;
  }

  private async getUserData(): Promise<User> {
    if (!this.userId) {
      return null;
    }

    const user = await this.database.getUserById(this.userId);
    if (!user) {
      throw new AssistantError(
        `User record not found for id: ${this.userId}`,
        ErrorType.NOT_FOUND,
      );
    }
    return user;
  }

  async checkUsage() {
    const userData = await this.getUserData();

    const dailyLimit = AUTH_DAILY_MESSAGE_LIMIT;

    const now = new Date();
    let dailyCount = userData.daily_message_count ?? 0;
    const lastReset = userData.daily_reset
      ? new Date(userData.daily_reset)
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
        await this.database.updateUser(this.userId, updates);
      } catch (resetError) {
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

    return { dailyCount, dailyLimit };
  }

  async incrementUsage() {
    const userData = await this.getUserData();

    const messageCount = userData.message_count ?? 0;
    const dailyCount = userData.daily_message_count ?? 0;

    const now = new Date();
    const lastReset = userData.daily_reset
      ? new Date(userData.daily_reset)
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
      await this.database.updateUser(this.userId, updates);
    } catch (updateError) {
      throw new AssistantError(
        "Failed to update usage data",
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  async checkProUsage(modelId: string) {
    const userData = await this.getUserData();
    const usageMultiplier = calculateUsageMultiplier(modelId);

    let dailyProCount = userData.daily_pro_message_count || 0;
    const now = new Date();
    const lastReset = userData.daily_pro_reset
      ? new Date(userData.daily_pro_reset)
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
        await this.database.updateUser(this.userId, updates);
      } catch (resetError) {
        throw new AssistantError(
          "Failed to reset pro usage",
          ErrorType.INTERNAL_ERROR,
        );
      }
    }

    if (dailyProCount >= DAILY_LIMIT_PRO_MODELS) {
      throw new AssistantError(
        "Daily Pro model limit reached.",
        ErrorType.USAGE_LIMIT_ERROR,
      );
    }

    const modelConfig = getModelConfigByMatchingModel(modelId);

    return {
      dailyProCount,
      limit: DAILY_LIMIT_PRO_MODELS,
      costMultiplier: usageMultiplier,
      modelCostInfo: {
        inputCost: modelConfig?.costPer1kInputTokens || 0,
        outputCost: modelConfig?.costPer1kOutputTokens || 0,
      },
    };
  }

  async incrementProUsage(modelId: string) {
    const userData = await this.getUserData();
    const usageMultiplier = calculateUsageMultiplier(modelId);

    const count = userData.daily_pro_message_count ?? 0;
    const messageCount = userData.message_count ?? 0;

    const now = new Date();
    const lastReset = userData.daily_pro_reset
      ? new Date(userData.daily_pro_reset)
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
      await this.database.updateUser(this.userId, updates);
    } catch (updateError) {
      throw new AssistantError(
        "Failed to increment pro usage",
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  async checkUsageByModel(modelId: string, isPro: boolean) {
    const modelIsPro = isProModel(modelId);

    if (modelIsPro) {
      if (!isPro) {
        throw new AssistantError(
          "You are not a paid user. Please upgrade to a paid plan to use this model.",
          ErrorType.AUTHENTICATION_ERROR,
        );
      }

      return await this.checkProUsage(modelId);
    }

    if (this.userId) {
      return await this.checkUsage();
    }

    const ANONYMOUS_LIMIT_HIT = false;
    if (ANONYMOUS_LIMIT_HIT) {
      throw new AssistantError(
        "Daily message limit for anonymous users reached. Please log in for higher limits.",
        ErrorType.USAGE_LIMIT_ERROR,
      );
    }

    return { dailyCount: 0, dailyLimit: NON_AUTH_DAILY_MESSAGE_LIMIT };
  }

  async incrementUsageByModel(modelId: string, isPro: boolean) {
    const modelIsPro = isProModel(modelId);

    if (modelIsPro) {
      if (isPro) {
        await this.incrementProUsage(modelId);
      } else {
        throw new AssistantError(
          "You are not a paid user. Please upgrade to a paid plan to use this model.",
          ErrorType.AUTHENTICATION_ERROR,
        );
      }
    } else {
      await this.incrementUsage();
    }
  }

  /**
   * Get usage limit information for a user
   * @returns UsageLimits object with information about regular and pro limits
   */
  async getUsageLimits(): Promise<UsageLimits> {
    const userData = await this.getUserData();

    const now = new Date();
    let regularDailyCount = userData.daily_message_count ?? 0;
    let proDailyCount = userData.daily_pro_message_count ?? 0;

    const lastReset = userData.daily_reset
      ? new Date(userData.daily_reset)
      : null;
    const isNewRegularDay =
      !lastReset ||
      now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCDate() !== lastReset.getUTCDate();

    if (isNewRegularDay) {
      regularDailyCount = 0;
    }

    const lastProReset = userData.daily_pro_reset
      ? new Date(userData.daily_pro_reset)
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
        limit: AUTH_DAILY_MESSAGE_LIMIT,
      },
    };

    if (userData.plan_id === "pro") {
      usageLimits.pro = {
        used: proDailyCount,
        limit: DAILY_LIMIT_PRO_MODELS,
      };
    }

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
    const usageMultiplier = calculateUsageMultiplier(modelId);
    const modelConfig = getModelConfigByMatchingModel(modelId);

    return {
      multiplier: usageMultiplier,
      modelCostInfo: {
        inputCost: modelConfig?.costPer1kInputTokens || 0,
        outputCost: modelConfig?.costPer1kOutputTokens || 0,
      },
    };
  }
}
