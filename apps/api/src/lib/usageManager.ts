import { usagePeriodFromDate, type UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";

import { USAGE_CONFIG } from "~/constants/app";
import type { RepositoryManager } from "~/repositories";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { hasPlanEntitlement } from "./plans";
import { resolveUsageBalanceSnapshot } from "./usage/balanceSnapshot";
import { usageCreditsFromBalance } from "./usage/creditSummary";
import { creditsAreEnforced } from "./usage/planSeed";

export interface UsageLimits {
  daily: {
    used: number;
    limit: number | null;
  };
  credits?: UsageCreditsSummary;
}

/**
 * Keeps the deliberately small message-count abuse guard separate from the credit ledger.
 * Paid work, BYOK cost and capability cost are never accounted for here.
 */
export class UsageManager {
  private regularUsageSnapshot?: { dailyCount: number; limit: number };
  private recordedAssistantResponse = false;

  constructor(
    private readonly repositories: RepositoryManager,
    private user: User | null,
    private readonly anonymousUser: AnonymousUser | null,
  ) {}

  private isPaidUser(): boolean {
    return hasPlanEntitlement(this.user?.plan_id, "pro");
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
    const lastReset = this.user.daily_reset ? new Date(this.user.daily_reset) : null;
    const dailyCount = this.isNewUtcDay(now, lastReset) ? 0 : (this.user.daily_message_count ?? 0);

    this.regularUsageSnapshot = {
      dailyCount,
      limit: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
    };

    return this.regularUsageSnapshot;
  }

  async checkUsage(): Promise<{ dailyCount: number; dailyLimit: number | null }> {
    if (this.user?.id) {
      if (this.isPaidUser()) {
        return { dailyCount: 0, dailyLimit: null };
      }

      const snapshot = this.getRegularUsageSnapshot();

      if (snapshot.dailyCount >= snapshot.limit) {
        throw new AssistantError(
          "Daily message limit for authenticated users reached.",
          ErrorType.USAGE_LIMIT_ERROR,
        );
      }

      return { dailyCount: snapshot.dailyCount, dailyLimit: snapshot.limit };
    }

    return this.checkAnonymousUsage();
  }

  async checkAnonymousUsage(): Promise<{ dailyCount: number; dailyLimit: number }> {
    if (!this.anonymousUser?.id) {
      throw new AssistantError(
        "Anonymous user required to check anonymous usage",
        ErrorType.PARAMS_ERROR,
      );
    }

    const dailyLimit = USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT;
    const { count: dailyCount } = await this.repositories.anonymousUsers.checkAndResetDailyLimit(
      this.anonymousUser.id,
    );

    if (dailyCount >= dailyLimit) {
      throw new AssistantError(
        "Daily message limit for anonymous users reached. Please log in for higher limits.",
        ErrorType.USAGE_LIMIT_ERROR,
      );
    }

    return { dailyCount, dailyLimit };
  }

  async incrementUsage(): Promise<void> {
    if (this.recordedAssistantResponse) {
      return;
    }

    if (this.user?.id) {
      const isPaid = this.isPaidUser();
      const updatedUser = await this.repositories.users.incrementUsageCounters(this.user.id, {
        message_count: 1,
        ...(isPaid ? {} : { daily_message_count: 1 }),
      });

      if (updatedUser) {
        this.user = updatedUser;
      }

      if (!isPaid && this.regularUsageSnapshot) {
        this.regularUsageSnapshot.dailyCount += 1;
      }

      this.recordedAssistantResponse = true;

      return;
    }

    await this.incrementAnonymousUsage();
    this.recordedAssistantResponse = true;
  }

  async incrementAnonymousUsage(): Promise<void> {
    if (!this.anonymousUser?.id) {
      throw new AssistantError(
        "Anonymous user required to increment anonymous usage",
        ErrorType.PARAMS_ERROR,
      );
    }

    await this.repositories.anonymousUsers.incrementDailyCount(this.anonymousUser.id);
  }

  async getUsageLimits(): Promise<UsageLimits> {
    if (!this.user?.id) {
      if (!this.anonymousUser?.id) {
        throw new AssistantError("User required to get usage limits", ErrorType.PARAMS_ERROR);
      }

      const { count } = await this.repositories.anonymousUsers.checkAndResetDailyLimit(
        this.anonymousUser.id,
      );

      return {
        daily: { used: count, limit: USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT },
      };
    }

    const isPaid = this.isPaidUser();
    const daily = isPaid
      ? { used: 0, limit: null }
      : {
          used: this.getRegularUsageSnapshot().dailyCount,
          limit: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
        };

    if (!isPaid) {
      return { daily };
    }

    const balance = await resolveUsageBalanceSnapshot(
      this.repositories,
      this.user.id,
      usagePeriodFromDate(),
    );

    if (!creditsAreEnforced({ includedCreditMicros: balance.included_credit_micros })) {
      return { daily };
    }

    return { daily, credits: usageCreditsFromBalance(balance) };
  }
}
