import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import {
  cancelSubscription,
  createCheckoutSession,
  getSubscriptionStatus,
  handleStripeWebhook,
  reactivateSubscription,
} from "../index";

const mockStripe = {
  customers: {
    create: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn(),
    update: vi.fn(),
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

const mockDatabase = {
  getPlanById: vi.fn(),
  updateUser: vi.fn(),
  getUserByStripeCustomerId: vi.fn(),
};

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => mockStripe),
}));

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: () => mockDatabase,
  },
}));

import {
  sendPaymentFailedEmail,
  sendSubscriptionCancellationNoticeEmail,
  sendSubscriptionEmail,
  sendUnsubscriptionEmail,
} from "~/services/notifications";

vi.mock("~/services/notifications", () => ({
  sendSubscriptionEmail: vi.fn(),
  sendSubscriptionCancellationNoticeEmail: vi.fn(),
  sendUnsubscriptionEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  sendTrialEndingEmail: vi.fn(),
}));

const mockEnv: IEnv = {
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
  const mockSendSubscriptionCancellationNoticeEmail = vi.mocked(
    sendSubscriptionCancellationNoticeEmail,
  );
  const mockSendUnsubscriptionEmail = vi.mocked(sendUnsubscriptionEmail);
  const mockSendPaymentFailedEmail = vi.mocked(sendPaymentFailedEmail);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCheckoutSession", () => {
    it("should create checkout session for new user", async () => {
      const mockPlan = { id: "plan-123", stripe_price_id: "price_123" };
      const mockCustomer = { id: "cus_123" };
      const mockSession = {
        id: "cs_123",
        url: "https://checkout.stripe.com/pay/cs_123",
      };

      mockDatabase.getPlanById.mockResolvedValue(mockPlan);
      mockStripe.customers.create.mockResolvedValue(mockCustomer);
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await createCheckoutSession(
        mockEnv,
        mockUser,
        "plan-123",
        "https://success.com",
        "https://cancel.com",
      );

      expect(mockDatabase.getPlanById).toHaveBeenCalledWith("plan-123");
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: "test@example.com",
        metadata: { user_id: "1" },
      });
      expect(mockDatabase.updateUser).toHaveBeenCalledWith(1, {
        stripe_customer_id: "cus_123",
      });
      expect(result).toEqual({
        session_id: "cs_123",
        url: "https://checkout.stripe.com/pay/cs_123",
      });
    });

    it("should throw error if user has active subscription", async () => {
      const userWithSubscription = {
        ...mockUser,
        stripe_subscription_id: "sub_123",
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        status: "active",
      });

      await expect(
        createCheckoutSession(
          mockEnv,
          userWithSubscription,
          "plan-123",
          "https://success.com",
          "https://cancel.com",
        ),
      ).rejects.toThrow("User already has an active subscription");
    });

    it("should throw error if plan not found", async () => {
      mockDatabase.getPlanById.mockResolvedValue(null);

      await expect(
        createCheckoutSession(
          mockEnv,
          mockUser,
          "nonexistent-plan",
          "https://success.com",
          "https://cancel.com",
        ),
      ).rejects.toThrow("Plan not found");
    });

    it("should throw error if Stripe secret key missing", async () => {
      const envWithoutKey = { ...mockEnv, STRIPE_SECRET_KEY: undefined };
      const mockPlan = { id: "plan-123", stripe_price_id: "price_123" };

      mockDatabase.getPlanById.mockResolvedValue(mockPlan);

      await expect(
        createCheckoutSession(
          envWithoutKey,
          mockUser,
          "plan-123",
          "https://success.com",
          "https://cancel.com",
        ),
      ).rejects.toThrow("Stripe secret key not configured");
    });
  });

  describe("getSubscriptionStatus", () => {
    it("should return inactive status for user without subscription", async () => {
      const result = await getSubscriptionStatus(mockEnv, mockUser);

      expect(result).toEqual({
        status: "inactive",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_end: null,
      });
    });

    it("should return subscription status for user with subscription", async () => {
      const userWithSubscription = {
        ...mockUser,
        stripe_subscription_id: "sub_123",
      };

      const mockSubscription = {
        status: "active",
        days_until_due: 30,
        cancel_at_period_end: false,
        cancel_at: null,
        trial_end: null,
        currency: "usd",
        items: { data: [] },
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await getSubscriptionStatus(mockEnv, userWithSubscription);

      expect(result).toEqual(mockSubscription);
    });

    it("should handle missing subscription and update user", async () => {
      const userWithSubscription = {
        ...mockUser,
        stripe_subscription_id: "sub_123",
      };

      mockStripe.subscriptions.retrieve.mockRejectedValue({
        code: "resource_missing",
      });

      const result = await getSubscriptionStatus(mockEnv, userWithSubscription);

      expect(mockDatabase.updateUser).toHaveBeenCalledWith(1, {
        stripe_subscription_id: null,
        plan_id: "free",
      });
      expect(result).toEqual({
        status: "inactive",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_end: null,
      });
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel subscription", async () => {
      const userWithSubscription = {
        ...mockUser,
        stripe_subscription_id: "sub_123",
      };

      const mockSubscription = {
        status: "active",
        cancel_at_period_end: false,
        days_until_due: 30,
      };

      const mockUpdatedSubscription = {
        status: "active",
        cancel_at_period_end: true,
        days_until_due: 30,
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      mockStripe.subscriptions.update.mockResolvedValue(
        mockUpdatedSubscription,
      );

      const result = await cancelSubscription(mockEnv, userWithSubscription);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: true,
      });
      expect(mockSendSubscriptionCancellationNoticeEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
      );
      expect(result).toEqual({
        status: "active",
        cancel_at_period_end: true,
        days_until_due: 30,
      });
    });

    it("should throw error if no subscription", async () => {
      await expect(cancelSubscription(mockEnv, mockUser)).rejects.toThrow(
        "No active subscription",
      );
    });

    it("should return current status if already cancelled", async () => {
      const userWithSubscription = {
        ...mockUser,
        stripe_subscription_id: "sub_123",
      };

      const mockSubscription = {
        status: "active",
        cancel_at_period_end: true,
        days_until_due: 30,
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await cancelSubscription(mockEnv, userWithSubscription);

      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: "active",
        cancel_at_period_end: true,
        days_until_due: 30,
      });
    });
  });

  describe("reactivateSubscription", () => {
    it("should reactivate cancelled subscription", async () => {
      const userWithSubscription = {
        ...mockUser,
        stripe_subscription_id: "sub_123",
      };

      const mockSubscription = {
        status: "active",
        cancel_at_period_end: true,
      };

      const mockUpdatedSubscription = {
        status: "active",
        cancel_at_period_end: false,
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      mockStripe.subscriptions.update.mockResolvedValue(
        mockUpdatedSubscription,
      );

      const result = await reactivateSubscription(
        mockEnv,
        userWithSubscription,
      );

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: false,
      });
      expect(result).toEqual({
        status: "active",
        cancel_at_period_end: false,
      });
    });

    it("should throw error if no subscription", async () => {
      await expect(reactivateSubscription(mockEnv, mockUser)).rejects.toThrow(
        "No active subscription",
      );
    });

    it("should return current status if not cancelled", async () => {
      const userWithSubscription = {
        ...mockUser,
        stripe_subscription_id: "sub_123",
      };

      const mockSubscription = {
        status: "active",
        cancel_at_period_end: false,
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await reactivateSubscription(
        mockEnv,
        userWithSubscription,
      );

      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: "active",
        cancel_at_period_end: false,
      });
    });
  });

  describe("handleStripeWebhook", () => {
    it("should handle checkout.session.completed event", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_123",
          },
        },
      };

      const mockUser = { id: 1, email: "test@example.com" };

      mockStripe.webhooks.constructEventAsync.mockResolvedValue(mockEvent);
      mockDatabase.getUserByStripeCustomerId.mockResolvedValue(mockUser);

      const result = await handleStripeWebhook(
        mockEnv,
        "test-signature",
        "test-payload",
      );

      expect(mockDatabase.updateUser).toHaveBeenCalledWith(1, {
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_123",
        plan_id: "pro",
      });
      expect(mockSendSubscriptionEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
        "Pro",
      );
      expect(result).toEqual({ received: true });
    });

    it("should handle customer.subscription.deleted event", async () => {
      const mockEvent = {
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
          },
        },
      };

      const mockUser = { id: 1, email: "test@example.com" };

      mockStripe.webhooks.constructEventAsync.mockResolvedValue(mockEvent);
      mockDatabase.getUserByStripeCustomerId.mockResolvedValue(mockUser);

      const result = await handleStripeWebhook(
        mockEnv,
        "test-signature",
        "test-payload",
      );

      expect(mockDatabase.updateUser).toHaveBeenCalledWith(1, {
        stripe_subscription_id: null,
        plan_id: "free",
      });
      expect(mockSendUnsubscriptionEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
      );
      expect(result).toEqual({ received: true });
    });

    it("should handle invoice.payment_failed event", async () => {
      const mockEvent = {
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_123",
          },
        },
      };

      const mockUser = { id: 1, email: "test@example.com" };

      mockStripe.webhooks.constructEventAsync.mockResolvedValue(mockEvent);
      mockDatabase.getUserByStripeCustomerId.mockResolvedValue(mockUser);

      const result = await handleStripeWebhook(
        mockEnv,
        "test-signature",
        "test-payload",
      );

      expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
      );
      expect(result).toEqual({ received: true });
    });

    it("should throw error for invalid webhook signature", async () => {
      mockStripe.webhooks.constructEventAsync.mockRejectedValue(
        new Error("Webhook signature verification failed"),
      );

      await expect(
        handleStripeWebhook(mockEnv, "invalid-signature", "test-payload"),
      ).rejects.toThrow("Invalid webhook signature");
    });

    it("should throw error for missing webhook secret", async () => {
      const envWithoutSecret = { ...mockEnv, STRIPE_WEBHOOK_SECRET: undefined };

      await expect(
        handleStripeWebhook(envWithoutSecret, "test-signature", "test-payload"),
      ).rejects.toThrow("Stripe webhook secret not configured");
    });
  });
});
