import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "~/services/email";
import type { IEnv } from "~/types";
import {
  sendPaymentFailedEmail,
  sendSubscriptionCancellationNoticeEmail,
  sendSubscriptionEmail,
  sendTrialEndingEmail,
  sendUnsubscriptionEmail,
} from "../index";

vi.mock("~/services/email", () => ({
  sendEmail: vi.fn(),
}));

const mockEnv: IEnv = {} as IEnv;

describe("Subscription Emails", () => {
  const mockSendEmail = vi.mocked(sendEmail);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendSubscriptionEmail", () => {
    it("should send subscription confirmation email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      await sendSubscriptionEmail(mockEnv, "test@example.com", "Pro");

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "test@example.com",
        "Subscription Confirmation",
        expect.stringContaining("Your Subscription has been Confirmed"),
        expect.stringContaining("Thank you for subscribing to the Pro plan!"),
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
        expect.stringContaining("Your Subscription has been Cancelled"),
        expect.stringContaining("We're sorry to see you go"),
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
        expect.stringContaining("Your Subscription Will End Soon"),
        expect.stringContaining("current billing period"),
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
        expect.stringContaining("Your Payment has Failed"),
        expect.stringContaining("update your payment method"),
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
        expect.stringContaining("Your Free Trial is Ending Soon"),
        expect.stringContaining("free trial period is ending"),
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
