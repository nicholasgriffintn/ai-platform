import { describe, expect, it, vi } from "vitest";

import type { RepositoryManager } from "~/repositories";
import type { AnonymousUser, IUser } from "~/types";
import { ErrorType } from "~/utils/errors";

import { checkSpeechAccess } from "../access";

function makeRepositories(spentCreditMicros: number) {
  return {
    repositories: {
      anonymousUsers: {
        getCreditSpend: vi.fn(async () => ({
          spentCreditMicros,
          reservedCreditMicros: 0,
        })),
      },
      plans: {
        getPlanById: vi.fn(async () => ({ included_credits: 20, grace_credits: 0 })),
      },
    } as unknown as RepositoryManager,
  };
}

const anonymousUser = { id: "anon-1" } as AnonymousUser;
const user = { id: 7, plan_id: "pro" } as IUser;

const ANONYMOUS_ALLOWANCE_CREDIT_MICROS = 15_000_000;

describe("checkSpeechAccess", () => {
  it("refuses an anonymous caller that asks for a paid provider", async () => {
    const { repositories } = makeRepositories(0);

    await expect(
      checkSpeechAccess({ repositories, anonymousUser, provider: "elevenlabs" }),
    ).rejects.toMatchObject({ type: ErrorType.AUTHENTICATION_ERROR });
  });

  it("refuses an anonymous caller that has spent its credits", async () => {
    const { repositories } = makeRepositories(ANONYMOUS_ALLOWANCE_CREDIT_MICROS * 2);

    await expect(checkSpeechAccess({ repositories, anonymousUser })).rejects.toMatchObject({
      type: ErrorType.USAGE_LIMIT_ERROR,
    });
  });

  it("allows an anonymous caller within its allowance on the platform-hosted provider", async () => {
    const { repositories } = makeRepositories(0);

    await expect(
      checkSpeechAccess({ repositories, anonymousUser, provider: "melotts" }),
    ).resolves.toBeUndefined();
  });

  it("leaves authenticated callers to the existing plan and key checks", async () => {
    const { repositories } = makeRepositories(ANONYMOUS_ALLOWANCE_CREDIT_MICROS * 2);

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
