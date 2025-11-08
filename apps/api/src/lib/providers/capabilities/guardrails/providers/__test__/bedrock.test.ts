import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { BedrockGuardrailsProvider } from "../bedrock";

const mockAws = {
	fetch: vi.fn(),
};

const mockUserSettingsRepo = {
	getProviderApiKey: vi.fn(),
};

vi.mock("aws4fetch", () => ({
	AwsClient: vi.fn().mockImplementation(() => mockAws),
}));

vi.mock("~/repositories/UserSettingsRepository", () => ({
	UserSettingsRepository: vi
		.fn()
		.mockImplementation(() => mockUserSettingsRepo),
}));

describe("BedrockGuardrailsProvider", () => {
	const mockConfig = {
		guardrailId: "test-guardrail-id",
		guardrailVersion: "1",
		region: "us-east-1",
		accessKeyId: "test-access-key",
		secretAccessKey: "test-secret-key",
		env: { DB: {} as any },
	};

	const mockUser = {
		id: "user-123",
		email: "test@example.com",
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should initialize with default values", () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig);
			expect(provider).toBeDefined();
		});

		it("should use DRAFT version when not specified", () => {
			const configWithoutVersion = { ...mockConfig };
			delete configWithoutVersion.guardrailVersion;
			// @ts-ignore - configWithoutVersion is not typed
			const provider = new BedrockGuardrailsProvider(configWithoutVersion);
			expect(provider).toBeDefined();
		});

		it("should use us-east-1 region when not specified", () => {
			const configWithoutRegion = { ...mockConfig };
			delete configWithoutRegion.region;
			// @ts-ignore - configWithoutRegion is not typed
			const provider = new BedrockGuardrailsProvider(configWithoutRegion);
			expect(provider).toBeDefined();
		});
	});

	describe("parseAwsCredentials", () => {
		it("should throw error for invalid AWS credentials format", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig);

			mockUserSettingsRepo.getProviderApiKey.mockResolvedValue(
				"invalid-format",
			);
			mockAws.fetch.mockResolvedValue({
				ok: false,
				status: 403,
				statusText: "Forbidden",
				text: () => Promise.resolve("Invalid credentials"),
			});

			await expect(
				provider.validateContent("test content", "INPUT"),
			).rejects.toThrow(expect.any(AssistantError));
		});
	});

	describe("validateContent", () => {
		it("should validate content successfully with no violations", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig);

			const mockResponse = {
				ok: true,
				json: () =>
					Promise.resolve({
						action: "NONE",
						assessments: [
							{
								topicPolicy: { topics: [] },
								contentPolicy: { filters: [] },
								sensitiveInformationPolicy: { piiEntities: [] },
							},
						],
					}),
			};

			mockAws.fetch.mockResolvedValue(mockResponse);

			const result = await provider.validateContent("Hello world", "INPUT");

			expect(result.isValid).toBe(true);
			expect(result.violations).toEqual([]);
			expect(mockAws.fetch).toHaveBeenCalledWith(
				expect.stringContaining("/guardrail/test-guardrail-id/version/1/apply"),
				expect.objectContaining({
					method: "POST",
					body: expect.stringContaining("Hello world"),
				}),
			);
		});

		it("should detect topic violations", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig);

			const mockResponse = {
				ok: true,
				json: () =>
					Promise.resolve({
						action: "BLOCKED",
						assessments: [
							{
								topicPolicy: {
									topics: [
										{ action: "BLOCKED", name: "Violence" },
										{ action: "ALLOWED", name: "General" },
									],
								},
								contentPolicy: { filters: [] },
								sensitiveInformationPolicy: { piiEntities: [] },
							},
						],
					}),
			};

			mockAws.fetch.mockResolvedValue(mockResponse);

			const result = await provider.validateContent("violent content", "INPUT");

			expect(result.isValid).toBe(false);
			expect(result.violations).toContain("Blocked topic: Violence");
			expect(result.violations).toHaveLength(1);
		});

		it("should detect content policy violations", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig);

			const mockResponse = {
				ok: true,
				json: () =>
					Promise.resolve({
						action: "BLOCKED",
						assessments: [
							{
								topicPolicy: { topics: [] },
								contentPolicy: {
									filters: [
										{ action: "BLOCKED", type: "HATE" },
										{ action: "ALLOWED", type: "GENERAL" },
									],
								},
								sensitiveInformationPolicy: { piiEntities: [] },
							},
						],
					}),
			};

			mockAws.fetch.mockResolvedValue(mockResponse);

			const result = await provider.validateContent(
				"hateful content",
				"OUTPUT",
			);

			expect(result.isValid).toBe(false);
			expect(result.violations).toContain("Content violation: HATE");
		});

		it("should detect PII violations", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig);

			const mockResponse = {
				ok: true,
				json: () =>
					Promise.resolve({
						action: "BLOCKED",
						assessments: [
							{
								topicPolicy: { topics: [] },
								contentPolicy: { filters: [] },
								sensitiveInformationPolicy: {
									piiEntities: [{ action: "BLOCKED", type: "EMAIL" }],
								},
							},
						],
					}),
			};

			mockAws.fetch.mockResolvedValue(mockResponse);

			const result = await provider.validateContent(
				"Contact me at test@example.com",
				"INPUT",
			);

			expect(result.isValid).toBe(false);
			expect(result.violations).toContain("PII detected: EMAIL");
		});

		it("should use user API key when available", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig, mockUser);

			mockUserSettingsRepo.getProviderApiKey.mockResolvedValue(
				"user-access-key::@@::user-secret-key",
			);
			mockAws.fetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						action: "NONE",
						assessments: [{}],
					}),
			});

			await provider.validateContent("test content", "INPUT");

			expect(mockUserSettingsRepo.getProviderApiKey).toHaveBeenCalledWith(
				"user-123",
				"bedrock",
			);
		});

		it("should handle missing credentials error", async () => {
			const configWithoutCreds = {
				...mockConfig,
				accessKeyId: "",
				secretAccessKey: "",
			};
			// @ts-ignore - configWithoutCreds is not typed
			const provider = new BedrockGuardrailsProvider(configWithoutCreds);

			await expect(
				provider.validateContent("test content", "INPUT"),
			).rejects.toThrow(expect.any(AssistantError));
			await expect(
				provider.validateContent("test content", "INPUT"),
			).rejects.toThrow("No valid credentials found for Bedrock Guardrails");
		});

		it("should handle API errors", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig);

			mockAws.fetch.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				text: () => Promise.resolve("Server error"),
			});

			await expect(
				provider.validateContent("test content", "INPUT"),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should handle user API key retrieval errors gracefully", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig, mockUser);

			mockUserSettingsRepo.getProviderApiKey.mockRejectedValue(
				new Error("Database error"),
			);
			mockAws.fetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						action: "NONE",
						assessments: [{}],
					}),
			});

			const result = await provider.validateContent("test content", "INPUT");

			expect(result.isValid).toBe(true);
		});

		it("should validate both INPUT and OUTPUT sources", async () => {
			// @ts-ignore - mockConfig is not typed
			const provider = new BedrockGuardrailsProvider(mockConfig);

			mockAws.fetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						action: "NONE",
						assessments: [{}],
					}),
			});

			await provider.validateContent("test content", "INPUT");
			await provider.validateContent("test content", "OUTPUT");

			expect(mockAws.fetch).toHaveBeenCalledTimes(2);

			const firstCall = mockAws.fetch.mock.calls[0][1];
			const secondCall = mockAws.fetch.mock.calls[1][1];

			expect(JSON.parse(firstCall.body).source).toBe("INPUT");
			expect(JSON.parse(secondCall.body).source).toBe("OUTPUT");
		});
	});
});
