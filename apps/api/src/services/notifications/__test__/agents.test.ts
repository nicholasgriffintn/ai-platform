import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "~/services/email";
import type { IEnv } from "~/types";
import {
  type AgentFeaturedNotification,
  type AgentModerationNotification,
  sendAgentFeaturedNotification,
  sendAgentModerationNotification,
} from "../index";

vi.mock("~/services/email", () => ({
  sendEmail: vi.fn(),
}));

const mockEnv: IEnv = {} as IEnv;

describe("Agent Notification Emails", () => {
  const mockSendEmail = vi.mocked(sendEmail);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendAgentModerationNotification", () => {
    it("should send approval notification email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      const notification: AgentModerationNotification = {
        agentName: "Test Agent",
        agentId: "agent-123",
        isApproved: true,
        moderatorName: "Admin User",
      };

      await sendAgentModerationNotification(
        mockEnv,
        "user@example.com",
        "John Doe",
        notification,
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "user@example.com",
        '🎉 Your agent "Test Agent" has been approved for the marketplace',
        expect.stringContaining("Agent Approved ✅"),
        expect.stringContaining("Test Agent"),
      );
    });

    it("should send rejection notification email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      const notification: AgentModerationNotification = {
        agentName: "Test Agent",
        agentId: "agent-123",
        isApproved: false,
        reason: "Content needs improvement",
        moderatorName: "Admin User",
      };

      await sendAgentModerationNotification(
        mockEnv,
        "user@example.com",
        "John Doe",
        notification,
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "user@example.com",
        '📝 Your agent "Test Agent" needs attention',
        expect.stringContaining("Agent Review Required ⚠️"),
        expect.stringContaining("Content needs improvement"),
      );
    });

    it("should handle email sending errors", async () => {
      mockSendEmail.mockRejectedValue(new Error("Email sending failed"));

      const notification: AgentModerationNotification = {
        agentName: "Test Agent",
        agentId: "agent-123",
        isApproved: true,
      };

      await expect(
        sendAgentModerationNotification(
          mockEnv,
          "user@example.com",
          "John Doe",
          notification,
        ),
      ).rejects.toThrow("Email sending failed");
    });
  });

  describe("sendAgentFeaturedNotification", () => {
    it("should send featured notification email", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      const notification: AgentFeaturedNotification = {
        agentName: "Test Agent",
        agentId: "agent-123",
        isFeatured: true,
        moderatorName: "Admin User",
      };

      await sendAgentFeaturedNotification(
        mockEnv,
        "user@example.com",
        "John Doe",
        notification,
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        mockEnv,
        "user@example.com",
        '🌟 Your agent "Test Agent" has been featured!',
        expect.stringContaining("🌟 Agent Featured!"),
        expect.stringContaining("Congratulations!"),
      );
    });

    it("should not send email when agent is not featured", async () => {
      const notification: AgentFeaturedNotification = {
        agentName: "Test Agent",
        agentId: "agent-123",
        isFeatured: false,
      };

      await sendAgentFeaturedNotification(
        mockEnv,
        "user@example.com",
        "John Doe",
        notification,
      );

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should handle email sending errors", async () => {
      mockSendEmail.mockRejectedValue(new Error("Email sending failed"));

      const notification: AgentFeaturedNotification = {
        agentName: "Test Agent",
        agentId: "agent-123",
        isFeatured: true,
      };

      await expect(
        sendAgentFeaturedNotification(
          mockEnv,
          "user@example.com",
          "John Doe",
          notification,
        ),
      ).rejects.toThrow("Email sending failed");
    });
  });
});
