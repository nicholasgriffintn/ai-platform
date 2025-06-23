import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";
import {
  sendPaymentFailedEmail,
  sendSubscriptionCancellationNoticeEmail,
  sendSubscriptionEmail,
  sendTrialEndingEmail,
  sendUnsubscriptionEmail,
} from "../emails";

vi.mock("~/services/email", () => ({
  sendEmail: vi.fn(),
}));

const mockEnv: IEnv = {} as IEnv;

describe("Subscription Emails", () => {
  let mockSendEmail: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const emailModule = await import("~/services/email");
    mockSendEmail = vi.mocked(emailModule.sendEmail);
  });

  describe("sendSubscriptionEmail", () => {
    it("should send subscription confirmation email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      await sendSubscriptionEmail(mockEnv, "test@example.com", "Pro");

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
        "Subscription Confirmation",
        "Thank you for subscribing to the Pro plan!",
        expect.stringContaining("<h1>Subscription Confirmed</h1>"),
      );
    });

    it("should handle email sending errors", async () => {
      mockSendEmail.mockRejectedValue(new Error("Email sending failed"));

      await expect(
        sendSubscriptionEmail(mockEnv, "test@example.com", "Pro"),
      ).rejects.toThrow("Email sending failed");
    });
  });

  describe("sendUnsubscriptionEmail", () => {
    it("should send unsubscription email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      await sendUnsubscriptionEmail(mockEnv, "test@example.com");

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
        "Subscription Cancelled",
        "We're sorry to see you go. Your subscription has been cancelled.",
        expect.stringContaining("<h1>Subscription Cancelled</h1>"),
      );
    });

    it("should handle email sending errors", async () => {
      mockSendEmail.mockRejectedValue(new Error("Email sending failed"));

      await expect(
        sendUnsubscriptionEmail(mockEnv, "test@example.com"),
      ).rejects.toThrow("Email sending failed");
    });
  });

  describe("sendSubscriptionCancellationNoticeEmail", () => {
    it("should send cancellation notice email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      await sendSubscriptionCancellationNoticeEmail(
        mockEnv,
        "test@example.com",
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
        "Your Subscription Will End Soon",
        "Your subscription will be canceled at the end of your current billing period.",
        expect.stringContaining("<h1>Subscription Will End Soon</h1>"),
      );
    });

    it("should handle email sending errors", async () => {
      mockSendEmail.mockRejectedValue(new Error("Email sending failed"));

      await expect(
        sendSubscriptionCancellationNoticeEmail(mockEnv, "test@example.com"),
      ).rejects.toThrow("Email sending failed");
    });
  });

  describe("sendPaymentFailedEmail", () => {
    it("should send payment failed email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      await sendPaymentFailedEmail(mockEnv, "test@example.com");

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
        "Payment Failed",
        "Your payment has failed. Please update your payment method to continue using Polychat.",
        expect.stringContaining("<h1>Payment Failed</h1>"),
      );
    });

    it("should handle email sending errors", async () => {
      mockSendEmail.mockRejectedValue(new Error("Email sending failed"));

      await expect(
        sendPaymentFailedEmail(mockEnv, "test@example.com"),
      ).rejects.toThrow("Email sending failed");
    });
  });

  describe("sendTrialEndingEmail", () => {
    it("should send trial ending email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      await sendTrialEndingEmail(mockEnv, "test@example.com");

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
        "Your Trial is Ending Soon",
        "Your free trial period is ending soon. To continue using premium features, please update your payment method.",
        expect.stringContaining("<h1>Your Trial is Ending Soon</h1>"),
      );
    });

    it("should handle email sending errors", async () => {
      mockSendEmail.mockRejectedValue(new Error("Email sending failed"));

      await expect(
        sendTrialEndingEmail(mockEnv, "test@example.com"),
      ).rejects.toThrow("Email sending failed");
    });
  });
});
