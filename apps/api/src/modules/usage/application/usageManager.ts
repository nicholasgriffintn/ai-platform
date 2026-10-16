import {
  anonymousCreditActor,
  resolveUsageBalanceSnapshot,
  usageCreditsFromBalance,
  userCreditActor,
  type CreditActor,
} from "@ngriffin_uk/polychat-ai-billing";
import { usagePeriodFromDate, type UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Repositories } from "~/infrastructure/database/repositories";
import { createUsageStore } from "~/modules/usage/application/runtime";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { AnonymousUser, User } from "~/types";

export interface UsageLimits {
  credits: UsageCreditsSummary;
}

export class UsageManager {
  private recordedAssistantResponse = false;

  constructor(
    private readonly repositories: Repositories,
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

    const updatedUser = await this.repositories
      .get(UserRepository)
      .incrementUsageCounters(this.user.id, {
        message_count: 1,
      });

    if (updatedUser) {
      this.user = updatedUser;
    }

    this.recordedAssistantResponse = true;
  }

  async getUsageLimits(): Promise<UsageLimits> {
    const balance = await resolveUsageBalanceSnapshot(
      createUsageStore(this.repositories),
      this.creditActor(),
      usagePeriodFromDate(),
    );

    return { credits: usageCreditsFromBalance(balance) };
  }
}
