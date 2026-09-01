import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import {
  cancelSubscription,
  createBillingPortalSession,
  createCheckoutSession,
  getSubscriptionStatus,
  handleStripeWebhook,
  reactivateSubscription,
  setOverageBilling,
} from "../index";

const mockStripe = {
  customers: {
    create: vi.fn(),
    listPaymentMethods: vi.fn(),
  },
  subscriptions: {
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

vi.mock("stripe", () => ({
  default: class {
    constructor() {
      return mockStripe;
    }
  },
}));

vi.mock("~/repositories", () => ({
  RepositoryManager: class {
    constructor() {
      return mockRepositories;
    }
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
  DB: {} as any,
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test_123",
  APP_BASE_URL: "https://app.example.com",
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

      mockRepositories.plans.getPlanById.mockResolvedValue(mockPlan);
      mockStripe.customers.create.mockResolvedValue(mockCustomer);
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await createCheckoutSession(
        mockEnv,
        mockUser,
        "plan-123",
        "https://app.example.com/success",
        "https://app.example.com/cancel",
      );

      expect(mockRepositories.plans.getPlanById).toHaveBeenCalledWith("plan-123");
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: "test@example.com",
        metadata: { user_id: "1" },
      });
      expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(1, {
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
          "https://app.example.com/success",
          "https://app.example.com/cancel",
        ),
      ).rejects.toThrow("User already has an active subscription");
    });

    it("should throw error if plan not found", async () => {
      mockRepositories.plans.getPlanById.mockResolvedValue(null);

      await expect(
        createCheckoutSession(
          mockEnv,
          mockUser,
          "nonexistent-plan",
          "https://app.example.com/success",
          "https://app.example.com/cancel",
        ),
      ).rejects.toThrow("Plan not found");
    });

    it("should throw error if Stripe secret key missing", async () => {
      const envWithoutKey = { ...mockEnv, STRIPE_SECRET_KEY: undefined };
      const mockPlan = { id: "plan-123", stripe_price_id: "price_123" };

      mockRepositories.plans.getPlanById.mockResolvedValue(mockPlan);

      await expect(
        createCheckoutSession(
          envWithoutKey,
          mockUser,
          "plan-123",
          "https://app.example.com/success",
          "https://app.example.com/cancel",
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

      expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(1, {
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
      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedSubscription);

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
      await expect(cancelSubscription(mockEnv, mockUser)).rejects.toThrow("No active subscription");
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
      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedSubscription);

      const result = await reactivateSubscription(mockEnv, userWithSubscription);

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

      const result = await reactivateSubscription(mockEnv, userWithSubscription);

      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: "active",
        cancel_at_period_end: false,
      });
    });
  });

  describe("createBillingPortalSession", () => {
    const customerUser = { ...mockUser, stripe_customer_id: "cus_123" } as IUser;

    it("creates a portal session for the customer", async () => {
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: "https://billing.stripe.com/session/xyz",
      });

      const result = await createBillingPortalSession(
        mockEnv,
        customerUser,
        "https://app.example.com/account",
      );

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        return_url: "https://app.example.com/account",
      });
      expect(result).toEqual({ url: "https://billing.stripe.com/session/xyz" });
    });

    it("rejects a return URL on a foreign origin", async () => {
      await expect(
        createBillingPortalSession(
          mockEnv,
          customerUser,
          "https://app.example.com.evil.net/account",
        ),
      ).rejects.toThrow("return_url must be a URL on the application origin");
      expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it("rejects when the user has no billing account", async () => {
      await expect(
        createBillingPortalSession(mockEnv, mockUser, "https://app.example.com/account"),
      ).rejects.toThrow("No billing account");
    });
  });

  describe("createCheckoutSession redirect validation", () => {
    it("rejects redirect URLs on a foreign origin", async () => {
      await expect(
        createCheckoutSession(
          mockEnv,
          mockUser,
          "plan-123",
          "https://evil.example.net/success",
          "https://app.example.com/cancel",
        ),
      ).rejects.toThrow("success_url must be a URL on the application origin");
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });

  describe("setOverageBilling", () => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const overageUser = {
      ...mockUser,
      plan_id: "pro",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
    } as IUser;

    const activeSubscription = (items: Array<{ id: string; price: { id: string } }>) => ({
      status: "active",
      customer: "cus_123",
      default_payment_method: "pm_1",
      items: { data: items },
    });

    beforeEach(() => {
      mockRepositories.plans.getPlanById.mockResolvedValue({
        id: "pro",
        overage_price_id: "price_overage",
      });
    });

    it("adds the metered item and enables the flag", async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        activeSubscription([{ id: "si_base", price: { id: "price_base" } }]),
      );

      const result = await setOverageBilling(mockEnv, overageUser, true);

      expect(mockStripe.subscriptionItems.create).toHaveBeenCalledWith({
        subscription: "sub_123",
        price: "price_overage",
      });
      expect(mockRepositories.usageBalances.setOverageEnabled).toHaveBeenCalledWith(
        1,
        currentPeriod,
        true,
      );
      expect(result).toEqual({ overage_enabled: true });
    });

    it("does not add a second item when the metered item already exists", async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        activeSubscription([
          { id: "si_base", price: { id: "price_base" } },
          { id: "si_overage", price: { id: "price_overage" } },
        ]),
      );

      await setOverageBilling(mockEnv, overageUser, true);

      expect(mockStripe.subscriptionItems.create).not.toHaveBeenCalled();
      expect(mockRepositories.usageBalances.setOverageEnabled).toHaveBeenCalledWith(
        1,
        currentPeriod,
        true,
      );
    });

    it("treats a Stripe already-exists rejection as success", async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        activeSubscription([{ id: "si_base", price: { id: "price_base" } }]),
      );
      mockStripe.subscriptionItems.create.mockRejectedValue(
        new Error("The subscription is already using that price."),
      );

      const result = await setOverageBilling(mockEnv, overageUser, true);

      expect(result).toEqual({ overage_enabled: true });
      expect(mockRepositories.usageBalances.setOverageEnabled).toHaveBeenCalledWith(
        1,
        currentPeriod,
        true,
      );
    });

    it("removes the metered item and disables the flag", async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        activeSubscription([
          { id: "si_base", price: { id: "price_base" } },
          { id: "si_overage", price: { id: "price_overage" } },
        ]),
      );

      const result = await setOverageBilling(mockEnv, overageUser, false);

      expect(mockStripe.subscriptionItems.del).toHaveBeenCalledWith("si_overage");
      expect(mockRepositories.usageBalances.setOverageEnabled).toHaveBeenCalledWith(
        1,
        currentPeriod,
        false,
      );
      expect(result).toEqual({ overage_enabled: false });
    });

    it("disables the flag without a Stripe call when no metered item exists", async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        activeSubscription([{ id: "si_base", price: { id: "price_base" } }]),
      );

      await setOverageBilling(mockEnv, overageUser, false);

      expect(mockStripe.subscriptionItems.del).not.toHaveBeenCalled();
      expect(mockRepositories.usageBalances.setOverageEnabled).toHaveBeenCalledWith(
        1,
        currentPeriod,
        false,
      );
    });

    it("refuses when the subscription is not active", async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        ...activeSubscription([]),
        status: "past_due",
      });

      await expect(setOverageBilling(mockEnv, overageUser, true)).rejects.toThrow(
        "Overage billing requires an active subscription",
      );
      expect(mockRepositories.usageBalances.setOverageEnabled).not.toHaveBeenCalled();
    });

    it("refuses to enable without a payment method", async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        ...activeSubscription([{ id: "si_base", price: { id: "price_base" } }]),
        default_payment_method: null,
      });
      mockStripe.customers.listPaymentMethods.mockResolvedValue({ data: [] });

      await expect(setOverageBilling(mockEnv, overageUser, true)).rejects.toThrow(
        "A payment method is required to enable overage billing",
      );
      expect(mockStripe.subscriptionItems.create).not.toHaveBeenCalled();
    });

    it("refuses when the plan has no overage price", async () => {
      mockRepositories.plans.getPlanById.mockResolvedValue({ id: "pro" });
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        activeSubscription([{ id: "si_base", price: { id: "price_base" } }]),
      );

      await expect(setOverageBilling(mockEnv, overageUser, true)).rejects.toThrow(
        "This plan does not support overage billing",
      );
    });

    it("refuses without a subscription", async () => {
      await expect(setOverageBilling(mockEnv, mockUser, true)).rejects.toThrow(
        "No active subscription",
      );
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

      const mockUser = { id: 1, email: "test@example.com", plan_id: "free" };

      mockStripe.webhooks.constructEventAsync.mockResolvedValue(mockEvent);
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue(mockUser);

      const result = await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(1, {
        stripe_subscription_id: "sub_123",
        plan_id: "pro",
      });
      expect(mockSendSubscriptionEmail).toHaveBeenCalledWith(mockEnv, "test@example.com", "Pro");
      expect(result).toEqual({ received: true });
    });

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

      const mockUser = {
        id: 1,
        email: "test@example.com",
        plan_id: "pro",
        stripe_subscription_id: "sub_123",
      };

      mockStripe.webhooks.constructEventAsync.mockResolvedValue(mockEvent);
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue(mockUser);

      const result = await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(1, {
        stripe_subscription_id: null,
        plan_id: "free",
      });
      expect(mockSendUnsubscriptionEmail).toHaveBeenCalledWith(mockEnv, "test@example.com");
      expect(result).toEqual({ received: true });
    });

    it("should revoke pro access and notify on invoice.payment_failed", async () => {
      const mockEvent = {
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_123",
          },
        },
      };

      const mockUser = { id: 1, email: "test@example.com", plan_id: "pro" };

      mockStripe.webhooks.constructEventAsync.mockResolvedValue(mockEvent);
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue(mockUser);

      const result = await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(1, { plan_id: "free" });
      expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(mockEnv, "test@example.com");
      expect(result).toEqual({ received: true });
    });

    it.each(["past_due", "unpaid", "incomplete_expired", "paused"])(
      "should revoke pro access when a subscription becomes %s",
      async (status) => {
        mockStripe.webhooks.constructEventAsync.mockResolvedValue({
          type: "customer.subscription.updated",
          data: { object: { id: "sub_123", customer: "cus_123", status } },
        });
        mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue({
          id: 1,
          email: "test@example.com",
          plan_id: "pro",
          stripe_subscription_id: "sub_123",
        });

        await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

        expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(1, { plan_id: "free" });
        expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(mockEnv, "test@example.com");
      },
    );

    it("should restore pro access when the subscription recovers", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValue({
        type: "customer.subscription.updated",
        data: { object: { id: "sub_123", customer: "cus_123", status: "active" } },
      });
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        plan_id: "free",
        stripe_subscription_id: "sub_123",
      });

      await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(1, { plan_id: "pro" });
      expect(mockSendPaymentFailedEmail).not.toHaveBeenCalled();
    });

    it("should not downgrade or notify twice when a past_due event is redelivered", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValue({
        type: "customer.subscription.updated",
        data: { object: { id: "sub_123", customer: "cus_123", status: "past_due" } },
      });
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        plan_id: "free",
        stripe_subscription_id: "sub_123",
      });

      await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.users.updateUser).not.toHaveBeenCalled();
      expect(mockSendPaymentFailedEmail).not.toHaveBeenCalled();
    });

    it("should leave an enterprise plan intact when a subscription lapses", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValue({
        type: "customer.subscription.updated",
        data: { object: { id: "sub_123", customer: "cus_123", status: "unpaid" } },
      });
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        plan_id: "enterprise",
        stripe_subscription_id: "sub_123",
      });

      await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.users.updateUser).not.toHaveBeenCalled();
      expect(mockSendPaymentFailedEmail).not.toHaveBeenCalled();
    });

    it("disables overage and resets entitlement when a subscription lapses", async () => {
      const currentPeriod = new Date().toISOString().slice(0, 7);

      mockStripe.webhooks.constructEventAsync.mockResolvedValue({
        type: "customer.subscription.updated",
        data: { object: { id: "sub_123", customer: "cus_123", status: "past_due" } },
      });
      mockRepositories.users.getUserByStripeCustomerId.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        plan_id: "pro",
        stripe_subscription_id: "sub_123",
      });
      mockRepositories.plans.getPlanById.mockResolvedValue({
        id: "free",
        included_credits: 0,
        grace_credits: 0,
      });

      await handleStripeWebhook(mockEnv, "test-signature", "test-payload");

      expect(mockRepositories.usageBalances.setPlanEntitlement).toHaveBeenCalledWith({
        userId: 1,
        period: currentPeriod,
        planId: "free",
        includedCreditMicros: 0,
        graceCreditMicros: 0,
      });
      expect(mockRepositories.usageBalances.setOverageEnabled).toHaveBeenCalledWith(
        1,
        currentPeriod,
        false,
      );
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

    it("should throw error for missing webhook secret", async () => {
      const envWithoutSecret = { ...mockEnv, STRIPE_WEBHOOK_SECRET: undefined };

      await expect(
        handleStripeWebhook(envWithoutSecret, "test-signature", "test-payload"),
      ).rejects.toThrow("Stripe webhook secret not configured");
    });
  });
});
