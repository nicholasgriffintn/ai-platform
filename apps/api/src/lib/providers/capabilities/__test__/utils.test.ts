import { describe, expect, it, vi } from "vitest";

import { generateWithProviderFallback } from "../utils";

type TestRequest = {
	prompt: string;
	model?: string;
};

type TestResult = {
	url: string;
};

type TestProvider = {
	generate(request: TestRequest): Promise<TestResult>;
};

describe("generateWithProviderFallback", () => {
	it("uses the requested provider when generation succeeds", async () => {
		const generate = vi.fn(
			async (_request: TestRequest): Promise<TestResult> => ({
				url: "primary",
			}),
		);
		const getProvider = vi.fn((_providerName: string): TestProvider => ({ generate }));

		await expect(
			generateWithProviderFallback<TestRequest, TestProvider>({
				providerName: "replicate",
				defaultProvider: "workers-ai",
				request: { prompt: "test" },
				getProvider,
			}),
		).resolves.toEqual({ url: "primary" });

		expect(getProvider).toHaveBeenCalledWith("replicate");
		expect(generate).toHaveBeenCalledWith({ prompt: "test" });
	});

	it("falls back to the default provider for provider-selected requests", async () => {
		const primaryGenerate = vi.fn(async (_request: TestRequest): Promise<TestResult> => {
			throw new Error("primary failed");
		});
		const fallbackGenerate = vi.fn(
			async (_request: TestRequest): Promise<TestResult> => ({
				url: "fallback",
			}),
		);
		const getProvider = vi.fn(
			(providerName: string): TestProvider => ({
				generate: providerName === "workers-ai" ? fallbackGenerate : primaryGenerate,
			}),
		);

		await expect(
			generateWithProviderFallback<TestRequest, TestProvider>({
				providerName: "replicate",
				defaultProvider: "workers-ai",
				request: { prompt: "test" },
				getProvider,
			}),
		).resolves.toEqual({ url: "fallback" });

		expect(getProvider).toHaveBeenCalledWith("replicate");
		expect(getProvider).toHaveBeenCalledWith("workers-ai");
	});

	it("does not fall back when the model explicitly selected the provider", async () => {
		const error = new Error("model provider failed");
		const getProvider = vi.fn(
			(): TestProvider => ({
				generate: vi.fn(async (_request: TestRequest): Promise<TestResult> => {
					throw error;
				}),
			}),
		);

		await expect(
			generateWithProviderFallback<TestRequest, TestProvider>({
				providerName: "replicate",
				defaultProvider: "workers-ai",
				request: { prompt: "test", model: "replicate-model" },
				getProvider,
			}),
		).rejects.toThrow(error);

		expect(getProvider).toHaveBeenCalledTimes(1);
	});

	it("does not fall back when fallback is disabled", async () => {
		const error = new Error("primary failed");
		const getProvider = vi.fn(
			(): TestProvider => ({
				generate: vi.fn(async (_request: TestRequest): Promise<TestResult> => {
					throw error;
				}),
			}),
		);

		await expect(
			generateWithProviderFallback<TestRequest, TestProvider>({
				providerName: "replicate",
				defaultProvider: "workers-ai",
				request: { prompt: "test" },
				getProvider,
				allowFallback: false,
			}),
		).rejects.toThrow(error);

		expect(getProvider).toHaveBeenCalledTimes(1);
	});
});
