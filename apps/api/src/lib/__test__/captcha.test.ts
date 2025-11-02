import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyCaptchaToken } from "../captcha";

global.fetch = vi.fn();

describe("verifyCaptchaToken", () => {
	const mockToken = "test-token";
	const mockSecret = "test-secret";
	const mockSitekey = "test-sitekey";

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return verified true for successful verification", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				success: true,
				challenge_ts: "2023-01-01T00:00:00.000Z",
				hostname: "example.com",
			}),
		};

		(global.fetch as any).mockResolvedValue(mockResponse);

		const result = await verifyCaptchaToken(mockToken, mockSecret, mockSitekey);

		expect(result).toEqual({ verified: true });
		expect(global.fetch).toHaveBeenCalledWith(
			"https://hcaptcha.com/siteverify",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					secret: mockSecret,
					response: mockToken,
					sitekey: mockSitekey,
				}),
			},
		);
	});

	it("should return verified false with error when verification fails", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				success: false,
				"error-codes": ["invalid-input-response", "missing-input-secret"],
			}),
		};

		(global.fetch as any).mockResolvedValue(mockResponse);

		const result = await verifyCaptchaToken(mockToken, mockSecret, mockSitekey);

		expect(result).toEqual({
			verified: false,
			error: "invalid-input-response, missing-input-secret",
		});
	});

	it("should return verified false with generic error when no error codes provided", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				success: false,
			}),
		};

		(global.fetch as any).mockResolvedValue(mockResponse);

		const result = await verifyCaptchaToken(mockToken, mockSecret, mockSitekey);

		expect(result).toEqual({
			verified: false,
			error: "Unknown verification error",
		});
	});

	it("should return verified false when HTTP request fails", async () => {
		const mockResponse = {
			ok: false,
			status: 400,
			statusText: "Bad Request",
		};

		(global.fetch as any).mockResolvedValue(mockResponse);

		const result = await verifyCaptchaToken(mockToken, mockSecret, mockSitekey);

		expect(result).toEqual({
			verified: false,
			error: "HTTP error 400: Bad Request",
		});
	});

	it("should return verified false when fetch throws an error", async () => {
		const errorMessage = "Network error";
		(global.fetch as any).mockRejectedValue(new Error(errorMessage));

		const result = await verifyCaptchaToken(mockToken, mockSecret, mockSitekey);

		expect(result).toEqual({
			verified: false,
			error: errorMessage,
		});
	});

	it("should return verified false when JSON parsing fails", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockRejectedValue(new Error("JSON parse error")),
		};

		(global.fetch as any).mockResolvedValue(mockResponse);

		const result = await verifyCaptchaToken(mockToken, mockSecret, mockSitekey);

		expect(result).toEqual({
			verified: false,
			error: "JSON parse error",
		});
	});

	it("should handle unknown error types", async () => {
		(global.fetch as any).mockRejectedValue("Unknown error");

		const result = await verifyCaptchaToken(mockToken, mockSecret, mockSitekey);

		expect(result).toEqual({
			verified: false,
			error: "Unknown error",
		});
	});
});
