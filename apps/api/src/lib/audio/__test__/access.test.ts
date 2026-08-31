import { describe, expect, it, vi } from "vitest";

import { USAGE_CONFIG } from "~/constants/app";
import type { RepositoryManager } from "~/repositories";
import type { AnonymousUser, IUser } from "~/types";
import { ErrorType } from "~/utils/errors";

import { checkSpeechAccess, recordSpeechUsage } from "../access";

function makeRepositories(dailyCount: number) {
  const incrementDailyCount = vi.fn(async () => {});

  return {
    incrementDailyCount,
    repositories: {
      anonymousUsers: {
        checkAndResetDailyLimit: vi.fn(async () => ({ count: dailyCount, isNewDay: false })),
        incrementDailyCount,
      },
    } as unknown as RepositoryManager,
  };
}

const anonymousUser = { id: "anon-1" } as AnonymousUser;
const user = { id: 7, plan_id: "pro" } as IUser;

describe("checkSpeechAccess", () => {
  it("refuses an anonymous caller that asks for a paid provider", async () => {
    const { repositories } = makeRepositories(0);

    await expect(
      checkSpeechAccess({ repositories, anonymousUser, provider: "elevenlabs" }),
    ).rejects.toMatchObject({ type: ErrorType.AUTHENTICATION_ERROR });
  });

  it("refuses an anonymous caller that has spent its daily allowance", async () => {
    const { repositories } = makeRepositories(USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT);

    await expect(checkSpeechAccess({ repositories, anonymousUser })).rejects.toMatchObject({
      type: ErrorType.USAGE_LIMIT_ERROR,
    });
  });

  it("allows an anonymous caller within its allowance on the platform-hosted provider", async () => {
    const { repositories } = makeRepositories(1);

    await expect(
      checkSpeechAccess({ repositories, anonymousUser, provider: "melotts" }),
    ).resolves.toBeUndefined();
  });

  it("leaves authenticated callers to the existing plan and key checks", async () => {
    const { repositories } = makeRepositories(USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT);

    await expect(
      checkSpeechAccess({ repositories, user, provider: "elevenlabs" }),
    ).resolves.toBeUndefined();
  });

  it("refuses a caller with neither an account nor an anonymous session", async () => {
    const { repositories } = makeRepositories(0);

    await expect(checkSpeechAccess({ repositories })).rejects.toMatchObject({
      type: ErrorType.AUTHENTICATION_ERROR,
    });
  });
});

describe("recordSpeechUsage", () => {
  it("counts an anonymous request against the daily allowance", async () => {
    const { repositories, incrementDailyCount } = makeRepositories(0);

    await recordSpeechUsage({ repositories, anonymousUser });

    expect(incrementDailyCount).toHaveBeenCalledWith("anon-1");
  });

  it("does not count an authenticated request against the anonymous allowance", async () => {
    const { repositories, incrementDailyCount } = makeRepositories(0);

    await recordSpeechUsage({ repositories, user, anonymousUser });

    expect(incrementDailyCount).not.toHaveBeenCalled();
  });
});
