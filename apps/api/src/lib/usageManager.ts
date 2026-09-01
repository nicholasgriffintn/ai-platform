import { usagePeriodFromDate, type UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { resolveUsageBalanceSnapshot } from "./usage/balanceSnapshot";
import { anonymousCreditActor, userCreditActor, type CreditActor } from "./usage/creditActor";
import { usageCreditsFromBalance } from "./usage/creditSummary";

export interface UsageLimits {
  credits: UsageCreditsSummary;
}

export class UsageManager {
  private recordedAssistantResponse = false;

  constructor(
    private readonly repositories: RepositoryManager,
    private user: User | null,
    private readonly anonymousUser: AnonymousUser | null,
  ) {}

  creditActor(): CreditActor {
    if (this.user?.id) {
      return userCreditActor(this.user.id);
    }

    if (this.anonymousUser?.id) {
      return anonymousCreditActor(this.anonymousUser.id);
    }

    throw new AssistantError(
      "A user or anonymous session is required for credit accounting",
      ErrorType.PARAMS_ERROR,
    );
  }

  async incrementUsage(): Promise<void> {
    if (this.recordedAssistantResponse || !this.user?.id) {
      return;
    }

    const updatedUser = await this.repositories.users.incrementUsageCounters(this.user.id, {
      message_count: 1,
    });

    if (updatedUser) {
      this.user = updatedUser;
    }

    this.recordedAssistantResponse = true;
  }

  async getUsageLimits(): Promise<UsageLimits> {
    const balance = await resolveUsageBalanceSnapshot(
      this.repositories,
      this.creditActor(),
      usagePeriodFromDate(),
    );

    return { credits: usageCreditsFromBalance(balance) };
  }
}
