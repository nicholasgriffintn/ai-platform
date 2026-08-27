import { beforeEach, describe, expect, it, vi } from "vitest";

import { USAGE_CONFIG } from "~/constants/app";
import type { RepositoryManager } from "~/repositories";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { UsageManager } from "../usageManager";

const mocks = vi.hoisted(() => ({
  getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/lib/providers/models", () => ({
  getModelConfigByMatchingModel: mocks.getModelConfigByMatchingModel,
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: "Test User",
    avatar_url: null,
    email: "user@example.com",
    github_username: null,
    company: null,
    site: null,
    location: null,
    bio: null,
    twitter_username: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    setup_at: null,
    terms_accepted_at: null,
    plan_id: "free",
    message_count: 0,
    daily_message_count: 0,
    daily_reset: new Date().toISOString(),
    daily_pro_message_count: 0,
    daily_pro_reset: new Date().toISOString(),
    byok_message_count: 0,
    daily_byok_message_count: 0,
    daily_byok_reset: new Date().toISOString(),
    ...overrides,
  };
}

function makeAnonymousUser(overrides: Partial<AnonymousUser> = {}): AnonymousUser {
  return {
    id: "anon-1",
    ip_address: "127.0.0.1",
    daily_message_count: 0,
    daily_reset: new Date().toISOString(),
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRepositories(overrides: Record<string, any> = {}): RepositoryManager {
  return {
    users: {
      updateUser: vi.fn(async () => {}),
    },
    anonymousUsers: {
      checkAndResetDailyLimit: vi.fn(async (_id: string) => ({
        count: 0,
        isNewDay: false,
      })),
      incrementDailyCount: vi.fn(async () => {}),
    },
    userSettings: {
      hasProviderApiKey: vi.fn(async () => false),
    },
    ...overrides,
  } as unknown as RepositoryManager;
}

async function expectAssistantError(promise: Promise<unknown>, type: ErrorType) {
  await expect(promise).rejects.toBeInstanceOf(AssistantError);
  await expect(promise).rejects.toMatchObject({ type });
}

describe("UsageManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getModelConfigByMatchingModel.mockResolvedValue(undefined);
  });

  describe("checkUsage", () => {
    it("does not throw one message below the daily limit", async () => {
      const user = makeUser({
        daily_message_count: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT - 1,
      });
      const manager = new UsageManager(makeRepositories(), user, null);

      await expect(manager.checkUsage()).resolves.toEqual({
        dailyCount: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT - 1,
        dailyLimit: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
      });
    });

    it("throws USAGE_LIMIT_ERROR once the daily count reaches the limit", async () => {
      const user = makeUser({
        daily_message_count: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
      });
      const manager = new UsageManager(makeRepositories(), user, null);

      await expectAssistantError(manager.checkUsage(), ErrorType.USAGE_LIMIT_ERROR);
    });

    it("resets the count for a user whose last reset was on a previous UTC day", async () => {
      const user = makeUser({
        daily_message_count: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
        daily_reset: "2020-01-01T00:00:00.000Z",
      });
      const manager = new UsageManager(makeRepositories(), user, null);

      await expect(manager.checkUsage()).resolves.toEqual({
        dailyCount: 0,
        dailyLimit: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
      });
    });
  });

  describe("incrementUsage", () => {
    it("throws PARAMS_ERROR when there is no authenticated user", async () => {
      const manager = new UsageManager(makeRepositories(), null, null);

      await expectAssistantError(manager.incrementUsage(), ErrorType.PARAMS_ERROR);
    });

    it("writes the incremented count directly when there is no task queue", async () => {
      const user = makeUser({ message_count: 5, daily_message_count: 5 });
      const repositories = makeRepositories();
      const manager = new UsageManager(repositories, user, null);

      await manager.incrementUsage();

      expect(repositories.users.updateUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ message_count: 6, daily_message_count: 6 }),
      );
      await expect(manager.checkUsage()).resolves.toMatchObject({
        dailyCount: 6,
      });
    });

    it("leaves the local counter consistent when the task-queue fast path is used", async () => {
      const user = makeUser({ message_count: 5, daily_message_count: 5 });
      const repositories = makeRepositories();
      const enqueueUsageTask = vi.fn(async () => {});
      const manager = new UsageManager(repositories, user, null, {
        enqueueUsageTask,
      });

      await manager.incrementUsage();

      expect(enqueueUsageTask).toHaveBeenCalledWith(
        expect.objectContaining({ action: "increment_usage", userId: 1 }),
      );
      expect(repositories.users.updateUser).not.toHaveBeenCalled();
      await expect(manager.checkUsage()).resolves.toMatchObject({
        dailyCount: 6,
      });
    });

    it("falls back to the direct DB write when enqueuing fails", async () => {
      const user = makeUser({ message_count: 5, daily_message_count: 5 });
      const repositories = makeRepositories();
      const enqueueUsageTask = vi.fn(async () => {
        throw new Error("queue unavailable");
      });
      const manager = new UsageManager(repositories, user, null, {
        enqueueUsageTask,
      });

      await manager.incrementUsage();

      expect(repositories.users.updateUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ daily_message_count: 6 }),
      );
    });
  });

  describe("checkAnonymousUsage", () => {
    it("throws PARAMS_ERROR when there is no anonymous user", async () => {
      const manager = new UsageManager(makeRepositories(), null, null);

      await expectAssistantError(manager.checkAnonymousUsage(), ErrorType.PARAMS_ERROR);
    });

    it("does not throw one message below the anonymous daily limit", async () => {
      const anonymousUser = makeAnonymousUser();
      const repositories = makeRepositories({
        anonymousUsers: {
          checkAndResetDailyLimit: vi.fn(async () => ({
            count: USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT - 1,
            isNewDay: false,
          })),
        },
      });
      const manager = new UsageManager(repositories, null, anonymousUser);

      await expect(manager.checkAnonymousUsage()).resolves.toEqual({
        dailyCount: USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT - 1,
        dailyLimit: USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT,
      });
    });

    it("throws USAGE_LIMIT_ERROR once the anonymous daily count reaches the limit", async () => {
      const anonymousUser = makeAnonymousUser();
      const repositories = makeRepositories({
        anonymousUsers: {
          checkAndResetDailyLimit: vi.fn(async () => ({
            count: USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT,
            isNewDay: false,
          })),
        },
      });
      const manager = new UsageManager(repositories, null, anonymousUser);

      await expectAssistantError(manager.checkAnonymousUsage(), ErrorType.USAGE_LIMIT_ERROR);
    });
  });

  describe("incrementAnonymousUsage", () => {
    it("throws PARAMS_ERROR when there is no anonymous user", async () => {
      const manager = new UsageManager(makeRepositories(), null, null);

      await expectAssistantError(manager.incrementAnonymousUsage(), ErrorType.PARAMS_ERROR);
    });

    it("increments via the repository when there is no task queue", async () => {
      const anonymousUser = makeAnonymousUser();
      const repositories = makeRepositories();
      const manager = new UsageManager(repositories, null, anonymousUser);

      await manager.incrementAnonymousUsage();

      expect(repositories.anonymousUsers.incrementDailyCount).toHaveBeenCalledWith("anon-1");
    });

    it("skips the direct increment when the task-queue fast path succeeds", async () => {
      const anonymousUser = makeAnonymousUser();
      const repositories = makeRepositories();
      const enqueueUsageTask = vi.fn(async () => {});
      const manager = new UsageManager(repositories, null, anonymousUser, {
        enqueueUsageTask,
      });

      await manager.incrementAnonymousUsage();

      expect(enqueueUsageTask).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "increment_anonymous_usage",
          anonymousUserId: "anon-1",
        }),
      );
      expect(repositories.anonymousUsers.incrementDailyCount).not.toHaveBeenCalled();
    });
  });

  describe("checkProUsage", () => {
    it("does not throw one message below the pro daily limit", async () => {
      const user = makeUser({
        daily_pro_message_count: USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS - 1,
      });
      const manager = new UsageManager(makeRepositories(), user, null);

      await expect(manager.checkProUsage("pro-model")).resolves.toMatchObject({
        dailyProCount: USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS - 1,
        limit: USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS,
      });
    });

    it("throws USAGE_LIMIT_ERROR once the pro daily count reaches the limit", async () => {
      const user = makeUser({
        daily_pro_message_count: USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS,
      });
      const manager = new UsageManager(makeRepositories(), user, null);

      await expectAssistantError(manager.checkProUsage("pro-model"), ErrorType.USAGE_LIMIT_ERROR);
    });
  });

  describe("incrementProUsage", () => {
    it("increments the pro count by the model's usage multiplier, not by one", async () => {
      mocks.getModelConfigByMatchingModel.mockResolvedValue({
        matchingModel: "expensive-model",
        provider: "test",
        costPer1kInputTokens: 0.005,
        costPer1kOutputTokens: 0.02,
      });
      const user = makeUser({ message_count: 10, daily_pro_message_count: 4 });
      const repositories = makeRepositories();
      const manager = new UsageManager(repositories, user, null);

      await manager.incrementProUsage("expensive-model");

      expect(repositories.users.updateUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          message_count: 11,
          daily_pro_message_count: 6,
        }),
      );
    });
  });

  describe("checkByokUsage", () => {
    it("never enforces a cap, unlike the free and pro paths", async () => {
      const user = makeUser({ daily_byok_message_count: 1_000_000 });
      const manager = new UsageManager(makeRepositories(), user, null);

      await expect(manager.checkByokUsage()).resolves.toEqual({
        dailyByokCount: 1_000_000,
        limit: null,
      });
    });
  });

  describe("incrementByokUsage", () => {
    it("throws PARAMS_ERROR when there is no authenticated user", async () => {
      const manager = new UsageManager(makeRepositories(), null, null);

      await expectAssistantError(manager.incrementByokUsage(), ErrorType.PARAMS_ERROR);
    });

    it("increments message, byok, and daily byok counts together", async () => {
      const user = makeUser({
        message_count: 1,
        byok_message_count: 2,
        daily_byok_message_count: 3,
      });
      const repositories = makeRepositories();
      const manager = new UsageManager(repositories, user, null);

      await manager.incrementByokUsage();

      expect(repositories.users.updateUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          message_count: 2,
          byok_message_count: 3,
          daily_byok_message_count: 4,
        }),
      );
    });
  });

  describe("checkUsageByModel", () => {
    it("blocks a non-pro user from a pro model without touching their free quota", async () => {
      mocks.getModelConfigByMatchingModel.mockResolvedValue({
        matchingModel: "pro-model",
        provider: "test",
        isFree: false,
      });
      const user = makeUser();
      const repositories = makeRepositories();
      const manager = new UsageManager(repositories, user, null);

      await expectAssistantError(
        manager.checkUsageByModel("pro-model", false),
        ErrorType.AUTHENTICATION_ERROR,
      );
      expect(repositories.users.updateUser).not.toHaveBeenCalled();
    });

    it("routes a free model for an authenticated user to the free-tier check", async () => {
      mocks.getModelConfigByMatchingModel.mockResolvedValue({
        matchingModel: "free-model",
        provider: "test",
        isFree: true,
      });
      const user = makeUser({ daily_message_count: 3 });
      const manager = new UsageManager(makeRepositories(), user, null);

      await expect(manager.checkUsageByModel("free-model", false)).resolves.toMatchObject({
        dailyCount: 3,
      });
    });
  });

  describe("getUsageLimits", () => {
    it("throws PARAMS_ERROR when there is neither an authenticated nor anonymous user", async () => {
      const manager = new UsageManager(makeRepositories(), null, null);

      await expectAssistantError(manager.getUsageLimits(), ErrorType.PARAMS_ERROR);
    });

    it("returns the anonymous daily allowance for an anonymous user", async () => {
      const anonymousUser = makeAnonymousUser();
      const repositories = makeRepositories({
        anonymousUsers: {
          checkAndResetDailyLimit: vi.fn(async () => ({
            count: 2,
            isNewDay: false,
          })),
        },
      });
      const manager = new UsageManager(repositories, null, anonymousUser);

      await expect(manager.getUsageLimits()).resolves.toEqual({
        daily: { used: 2, limit: USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT },
      });
    });

    it("omits the pro allowance for a free-plan authenticated user", async () => {
      const user = makeUser({ plan_id: "free", daily_message_count: 1 });
      const manager = new UsageManager(makeRepositories(), user, null);

      const limits = await manager.getUsageLimits();

      expect(limits.pro).toBeUndefined();
      expect(limits.daily).toEqual({
        used: 1,
        limit: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT,
      });
      expect(limits.byok).toEqual({ used: 0, limit: null });
    });

    it("includes the pro allowance for a pro-plan authenticated user", async () => {
      const user = makeUser({ plan_id: "pro", daily_pro_message_count: 7 });
      const manager = new UsageManager(makeRepositories(), user, null);

      await expect(manager.getUsageLimits()).resolves.toMatchObject({
        pro: { used: 7, limit: USAGE_CONFIG.DAILY_LIMIT_PRO_MODELS },
      });
    });
  });

  describe("getModelUsageMultiplier", () => {
    it("returns the calculated multiplier for a model with cost data", async () => {
      mocks.getModelConfigByMatchingModel.mockResolvedValue({
        matchingModel: "expensive-model",
        provider: "test",
        costPer1kInputTokens: 0.005,
        costPer1kOutputTokens: 0.02,
      });
      const manager = new UsageManager(makeRepositories(), makeUser(), null);

      await expect(manager.getModelUsageMultiplier("expensive-model")).resolves.toEqual({
        multiplier: 2,
        modelCostInfo: { inputCost: 0.005, outputCost: 0.02 },
      });
    });

    it("defaults to a multiplier of 1 for a model with no known config", async () => {
      mocks.getModelConfigByMatchingModel.mockResolvedValue(undefined);
      const manager = new UsageManager(makeRepositories(), makeUser(), null);

      await expect(manager.getModelUsageMultiplier("unknown-model")).resolves.toEqual({
        multiplier: 1,
        modelCostInfo: { inputCost: 0, outputCost: 0 },
      });
    });
  });
});
