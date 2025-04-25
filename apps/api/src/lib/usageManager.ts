import type { Database } from "~/lib/database";
import { getModelConfig } from "~/lib/models";
import type { ModelConfigItem } from "~/types";
import type { User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

// TODO: Define these limits in a central config or env vars
const NON_AUTH_DAILY_MESSAGE_LIMIT = 10;
const AUTH_DAILY_MESSAGE_LIMIT = 50;
const DAILY_LIMIT_PRO_MODELS = 100;

function isProModel(modelId: string): boolean {
  const config: ModelConfigItem | undefined = getModelConfig(modelId);
  return !!config && !config.isFree;
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

  async checkProUsage() {
    const userData = await this.getUserData();

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

    return { dailyProCount, limit: DAILY_LIMIT_PRO_MODELS };
  }

  async incrementProUsage() {
    const userData = await this.getUserData();

    const count = userData.daily_pro_message_count ?? 0;

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

    const updates = {
      daily_pro_message_count: currentDailyCount + 1,
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
    const userData = await this.getUserData();
    const modelIsPro = isProModel(modelId);

    if (modelIsPro) {
      if (!isPro) {
        throw new AssistantError(
          "You are not a paid user. Please upgrade to a paid plan to use this model.",
          ErrorType.AUTHENTICATION_ERROR,
        );
      }

      return await this.checkProUsage();
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
        await this.incrementProUsage();
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
}
