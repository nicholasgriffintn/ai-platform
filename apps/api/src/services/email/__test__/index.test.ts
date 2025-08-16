import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { sendEmail } from "../index";

const mockAwsClient = {
  sign: vi.fn(),
};

const mockFetch = vi.fn();

vi.mock("aws4fetch", () => ({
  AwsClient: vi.fn().mockImplementation(() => mockAwsClient),
}));

global.fetch = mockFetch;
global.TextEncoder = class {
  encode(str: string) {
    return new Uint8Array(str.length);
  }
} as any;

describe("Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendEmail", () => {
    const mockEnv = {
      AWS_SES_ACCESS_KEY_ID: "test-key-id",
      AWS_SES_SECRET_ACCESS_KEY: "test-secret-key",
      SES_EMAIL_FROM: "test@example.com",
    } as any;

    it("should send email successfully", async () => {
      const mockSignedRequest = new Request("https://example.com");
      const mockResponse = {
        ok: true,
        statusText: "OK",
      };

      mockAwsClient.sign.mockResolvedValue(mockSignedRequest);
      mockFetch.mockResolvedValue(mockResponse);

      await sendEmail(
        mockEnv,
        "recipient@example.com",
        "Test Subject",
        "Test body text",
        "<p>Test body HTML</p>",
      );

      expect(mockAwsClient.sign).toHaveBeenCalledWith(expect.any(Request));
      expect(mockFetch).toHaveBeenCalledWith(mockSignedRequest);
    });

    it("should throw error for missing AWS configuration", async () => {
      const incompleteEnv = {
        AWS_SES_ACCESS_KEY_ID: "test-key-id",
      } as any;

      await expect(
        sendEmail(
          incompleteEnv,
          "recipient@example.com",
          "Test Subject",
          "Test body text",
          "<p>Test body HTML</p>",
        ),
      ).rejects.toThrow(
        new AssistantError(
          "AWS SES configuration missing",
          ErrorType.CONFIGURATION_ERROR,
        ),
      );
    });

    it("should handle SES API errors", async () => {
      const mockSignedRequest = new Request("https://example.com");
      const mockResponse = {
        ok: false,
        statusText: "Bad Request",
        text: vi.fn().mockResolvedValue("SES error details"),
      };

      mockAwsClient.sign.mockResolvedValue(mockSignedRequest);
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        sendEmail(
          mockEnv,
          "recipient@example.com",
          "Test Subject",
          "Test body text",
          "<p>Test body HTML</p>",
        ),
      ).rejects.toMatchObject({
        message: "Failed to send email: Failed to send email: Bad Request",
        type: ErrorType.EMAIL_SEND_FAILED,
        name: "AssistantError",
      });
    });

    it("should handle network errors", async () => {
      const mockSignedRequest = new Request("https://example.com");

      mockAwsClient.sign.mockResolvedValue(mockSignedRequest);
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(
        sendEmail(
          mockEnv,
          "recipient@example.com",
          "Test Subject",
          "Test body text",
          "<p>Test body HTML</p>",
        ),
      ).rejects.toMatchObject({
        message: "Failed to send email: Network error",
        type: ErrorType.EMAIL_SEND_FAILED,
        name: "AssistantError",
      });
    });

    it("should construct correct request", async () => {
      const mockSignedRequest = new Request("https://example.com");
      const mockResponse = { ok: true, statusText: "OK" };

      mockAwsClient.sign.mockResolvedValue(mockSignedRequest);
      mockFetch.mockResolvedValue(mockResponse);

      await sendEmail(
        mockEnv,
        "recipient@example.com",
        "Test Subject",
        "Test body text",
        "<p>Test body HTML</p>",
      );

      const signCall = mockAwsClient.sign.mock.calls[0][0];
      expect(signCall.method).toBe("POST");
      expect(signCall.headers.get("Content-Type")).toBe("application/json");
      expect(signCall.url).toBe(
        "https://email.us-east-1.amazonaws.com/v2/email/outbound-emails",
      );
      expect(mockAwsClient.sign).toHaveBeenCalledWith(expect.any(Request));
      expect(mockFetch).toHaveBeenCalledWith(mockSignedRequest);
    });
  });
});
