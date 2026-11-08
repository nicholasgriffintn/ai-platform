import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { createCheckoutSession, handleStripeWebhook } from "../index";

const mockStripe = {
  customers: {
    create: vi.fn(),
    listPaymentMethods: vi.fn(),
  },
  subscriptions: {
    list: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  subscriptionItems: {
    create: vi.fn(),
    del: vi.fn(),
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  webhooks: {
    constructEventAsync: vi.fn(),
  },
};

const mockRepositories = {
  plans: {
    getPlanById: vi.fn(),
    getPlanByStripePriceId: vi.fn(),
  },
  users: {
    updateUser: vi.fn(),
    getUserByStripeCustomerId: vi.fn(),
  },
  usageBalances: {
    ensureBalance: vi.fn(),
    setOverageEnabled: vi.fn(),
    setPlanEntitlement: vi.fn(),
  },
};

vi.mock("stripe", () => {
  class MockStripe {
    constructor() {
      return mockStripe;
    }
  }

  return { default: MockStripe, Stripe: MockStripe };
});

vi.mock("~/modules/plans/infrastructure/PlanRepository", () => ({
  PlanRepository: class {
    constructor() {
      return mockRepositories.plans;
    }
  },
}));

vi.mock("~/modules/user/infrastructure/UserRepository", () => ({
  UserRepository: class {
    constructor() {
      return mockRepositories.users;
    }
  },
}));

vi.mock("~/modules/usage/infrastructure/UsageBalanceRepository", () => ({
  UsageBalanceRepository: class {
    constructor() {
      return mockRepositories.usageBalances;
    }
  },
}));

import { sendSubscriptionEmail } from "~/modules/notifications/application";

vi.mock("~/modules/notifications/application", () => ({
  sendSubscriptionEmail: vi.fn(),
  sendSubscriptionCancellationNoticeEmail: vi.fn(),
  sendUnsubscriptionEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  sendTrialEndingEmail: vi.fn(),
}));

const mockEnv: IEnv = {
  DB: {} as any,
  APP_BASE_URL: "https://app.polychat.test",
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test_123",
} as IEnv;

const mockUser: IUser = {
  id: 1,
  email: "test@example.com",
  stripe_customer_id: null,
  stripe_subscription_id: null,
} as IUser;

describe("Subscription Service", () => {
  const mockSendSubscriptionEmail = vi.mocked(sendSubscriptionEmail);

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [] } });
    mockRepositories.plans.getPlanByStripePriceId.mockResolvedValue(null);
  });

  describe("createCheckoutSession", () => {
    it("should reject return URLs outside the configured app before creating Stripe resources", async () => {
      mockRepositories.plans.getPlanById.mockResolvedValue({
        id: "pro",
        stripe_price_id: "price_123",
      });

      await expect(
        createCheckoutSession(
          mockEnv,
          mockUser,
          "pro",
          "https://evil.example/paid",
          "https://app.polychat.test/profile?tab=billing",
        ),
      ).rejects.toMatchObject({
        message: "success_url must be a URL on the application origin",
        type: "PARAMS_ERROR",
        statusCode: 400,
      });

      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });

  describe("handleStripeWebhook", () => {
    it("should not repeat the checkout side effects when the event is redelivered", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_123",
          },
        },
      };

      mockStripe.webhooks.constructEventAsync.mockResolvedValue(mockEvent);
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        plan_id: "pro",
        stripe_subscription_id: "sub_123",
      });

      await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.users.updateUser).not.toHaveBeenCalled();
      expect(mockSendSubscriptionEmail).not.toHaveBeenCalled();
    });

    it("seeds entitlement from the plan when checkout completes", async () => {
      const currentPeriod = new Date().toISOString().slice(0, 7);

      mockStripe.webhooks.constructEventAsync.mockResolvedValue({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_123", subscription: "sub_123" } },
      });
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        plan_id: "free",
      });
      mockRepositories.plans.getPlanById.mockResolvedValue({
        id: "pro",
        included_credits: 1000,
      });

      await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.usageBalances.setPlanEntitlement).toHaveBeenCalledWith({
        userId: 1,
        period: currentPeriod,
        planId: "pro",
        includedCreditMicros: 1_000_000_000,
        graceCreditMicros: 100_000_000,
      });
      expect(mockRepositories.usageBalances.setOverageEnabled).not.toHaveBeenCalled();
    });

    it("should throw error for invalid webhook signature", async () => {
      mockStripe.webhooks.constructEventAsync.mockRejectedValue(
        new Error("Webhook signature verification failed"),
      );

      await expect(
        handleStripeWebhook(mockEnv, "invalid-signature", "test-payload"),
      ).rejects.toThrow("Invalid webhook signature");
    });
  });
});
