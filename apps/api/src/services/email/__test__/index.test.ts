import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorType } from "~/utils/errors";
import { EMAIL_PROVIDERS } from "~/constants/email";
import type { IEnv } from "~/types";
import { sendEmail } from "../index";

const mockAwsClient = {
	sign: vi.fn(),
};

const mockFetch = vi.fn();

vi.mock("aws4fetch", () => {
	class MockAwsClient {
		sign = mockAwsClient.sign;
		constructor() {
			Object.assign(this, mockAwsClient);
		}
	}
	return {
		AwsClient: MockAwsClient,
	};
});

global.fetch = mockFetch;
Object.defineProperty(global, "TextEncoder", {
	value: class TextEncoderMock {
		encode(str: string): Uint8Array {
			return new Uint8Array(str.length);
		}
		encodeInto(): { written: number; read?: number } {
			return { written: 0, read: 0 };
		}
		get encoding(): string {
			return "utf-8";
		}
	},
	writable: true,
});

describe("Email Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("sendEmail", () => {
		const mockSESConfig = {
			AWS_SES_ACCESS_KEY_ID: "test-key-id",
			AWS_SES_SECRET_ACCESS_KEY: "test-secret-key",
			SES_EMAIL_FROM: "test@example.com",
		};

		const mockResendConfig = {
			RESEND_API_KEY: "re_test-key",
			SES_EMAIL_FROM: "test@example.com",
		};

		const createMockEnv = (config: Partial<IEnv>): IEnv => ({
			ANALYTICS:
				{} as import("@cloudflare/workers-types").AnalyticsEngineDataset,
			AI: {} as import("@cloudflare/workers-types").Ai,
			VECTOR_DB: {} as import("@cloudflare/workers-types").Vectorize,
			DB: {} as import("@cloudflare/workers-types").D1Database,
			CACHE: {} as import("@cloudflare/workers-types").KVNamespace,
			ACCOUNT_ID: "test-account",
			ASSETS_BUCKET: {} as import("@cloudflare/workers-types").R2Bucket,
			ASSETS_BUCKET_ACCESS_KEY_ID: "test",
			ASSETS_BUCKET_SECRET_ACCESS_KEY: "test",
			...config,
		});

		describe("when using AWS SES", () => {
			const mockEnv = createMockEnv({
				EMAIL_PROVIDER: EMAIL_PROVIDERS.AWS_SES,
				...mockSESConfig,
			});

			it("should send email successfully", async () => {
				const mockSignedRequest = new Request("https://example.com");
				const mockResponse = {
					ok: true,
					statusText: "OK",
				} as Response;

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
				const incompleteEnv = createMockEnv({
					EMAIL_PROVIDER: EMAIL_PROVIDERS.AWS_SES,
					AWS_SES_ACCESS_KEY_ID: "test-key-id",
				});

				await expect(
					sendEmail(
						incompleteEnv,
						"recipient@example.com",
						"Test Subject",
						"Test body text",
						"<p>Test body HTML</p>",
					),
				).rejects.toMatchObject({
					message: "AWS SES configuration missing",
					type: ErrorType.CONFIGURATION_ERROR,
					name: "AssistantError",
				});
			});

			it("should handle SES API errors", async () => {
				const mockSignedRequest = new Request("https://example.com");
				const mockResponse = {
					ok: false,
					statusText: "Bad Request",
					text: vi.fn().mockResolvedValue("SES error details"),
				} as unknown as Response;

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
				).rejects.toThrow(
					expect.objectContaining({
						message: "Failed to send email: Bad Request",
						type: ErrorType.EMAIL_SEND_FAILED,
						name: "AssistantError",
					}),
				);
			});
		});

		describe("when using Resend", () => {
			const mockEnv = createMockEnv({
				EMAIL_PROVIDER: EMAIL_PROVIDERS.RESEND,
				...mockResendConfig,
			});

			it("should send email successfully", async () => {
				const mockResponse = {
					ok: true,
					statusText: "OK",
				} as Response;

				mockFetch.mockResolvedValue(mockResponse);

				await sendEmail(
					mockEnv,
					"recipient@example.com",
					"Test Subject",
					"Test body text",
					"<p>Test body HTML</p>",
				);

				const request = mockFetch.mock.calls[0][0] as Request;
				expect(request.url).toBe("https://api.resend.com/emails");
				expect(request.method).toBe("POST");
				expect(request.headers.get("Authorization")).toBe("Bearer re_test-key");
				expect(request.headers.get("Content-Type")).toBe("application/json");
			});

			it("should throw error for missing Resend configuration", async () => {
				const incompleteEnv = createMockEnv({
					EMAIL_PROVIDER: EMAIL_PROVIDERS.RESEND,
					SES_EMAIL_FROM: "test@example.com",
				});

				await expect(
					sendEmail(
						incompleteEnv,
						"recipient@example.com",
						"Test Subject",
						"Test body text",
						"<p>Test body HTML</p>",
					),
				).rejects.toMatchObject({
					message: "Resend configuration missing",
					type: ErrorType.CONFIGURATION_ERROR,
					name: "AssistantError",
				});
			});

			it("should handle Resend API errors", async () => {
				const mockResponse = {
					ok: false,
					statusText: "Unauthorized",
					text: vi.fn().mockResolvedValue("Invalid API key"),
				} as unknown as Response;

				mockFetch.mockResolvedValue(mockResponse);

				await expect(
					sendEmail(
						mockEnv,
						"recipient@example.com",
						"Test Subject",
						"Test body text",
						"<p>Test body HTML</p>",
					),
				).rejects.toThrow(
					expect.objectContaining({
						message: "Failed to send email: Unauthorized",
						type: ErrorType.EMAIL_SEND_FAILED,
					}),
				);
			});

			it("should construct correct Resend request", async () => {
				const mockResponse = { ok: true, statusText: "OK" } as Response;
				mockFetch.mockResolvedValue(mockResponse);

				await sendEmail(
					mockEnv,
					"recipient@example.com",
					"Test Subject",
					"Test body text",
					"<p>Test body HTML</p>",
				);

				const request = mockFetch.mock.calls[0][0] as Request;
				expect(request.url).toBe("https://api.resend.com/emails");
				expect(request.method).toBe("POST");
				expect(request.headers.get("Authorization")).toBe("Bearer re_test-key");
				expect(request.headers.get("Content-Type")).toBe("application/json");

				// Verify the request body is present
				expect(request.body).toBeDefined();
			});
		});

		describe("when no provider is specified", () => {
			it("should default to AWS SES", async () => {
				const mockEnv = createMockEnv(mockSESConfig);
				const mockSignedRequest = new Request("https://example.com");
				const mockResponse = { ok: true, statusText: "OK" } as Response;

				mockAwsClient.sign.mockResolvedValue(mockSignedRequest);
				mockFetch.mockResolvedValue(mockResponse);

				await sendEmail(
					mockEnv,
					"recipient@example.com",
					"Test Subject",
					"Test body text",
					"<p>Test body HTML</p>",
				);

				expect(mockAwsClient.sign).toHaveBeenCalled();
			});
		});

		describe("when unsupported provider is specified", () => {
			it("should throw configuration error", async () => {
				const mockEnv = createMockEnv({
					EMAIL_PROVIDER: "unsupported_provider",
					...mockSESConfig,
				});

				await expect(
					sendEmail(
						mockEnv,
						"recipient@example.com",
						"Test Subject",
						"Test body text",
						"<p>Test body HTML</p>",
					),
				).rejects.toMatchObject({
					message: "Unsupported email provider: unsupported_provider",
					type: ErrorType.CONFIGURATION_ERROR,
					name: "AssistantError",
				});
			});
		});

		describe("network error handling", () => {
			it("should handle network errors with AWS SES", async () => {
				const mockEnv = createMockEnv({
					EMAIL_PROVIDER: EMAIL_PROVIDERS.AWS_SES,
					...mockSESConfig,
				});
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

			it("should handle network errors with Resend", async () => {
				const mockEnv = createMockEnv({
					EMAIL_PROVIDER: EMAIL_PROVIDERS.RESEND,
					...mockResendConfig,
				});

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
		});
	});
});
