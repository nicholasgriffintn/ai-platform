import { describe, expect, it } from "vitest";
import type { IEnv } from "~/types";
import { AssistantError } from "~/utils/errors";
import { SearchProviderFactory } from "../factory";
import { DuckDuckGoProvider } from "../duckduckgo";
import { ParallelSearchProvider } from "../parallel";
import { SerperProvider } from "../serper";
import { TavilyProvider } from "../tavily";

describe("SearchProviderFactory", () => {
	const mockEnv: IEnv = {
		SERPER_API_KEY: "test-serper-key",
		TAVILY_API_KEY: "test-tavily-key",
		PARALLEL_API_KEY: "test-parallel-key",
		AI_GATEWAY_TOKEN: "test-gateway-token",
		ACCOUNT_ID: "test-account-id",
	} as IEnv;

	describe("getProvider", () => {
		it("should create SerperProvider when provider is serper", () => {
			const provider = SearchProviderFactory.getProvider("serper", mockEnv);
			expect(provider).toBeInstanceOf(SerperProvider);
		});

		it("should create TavilyProvider when provider is tavily", () => {
			const provider = SearchProviderFactory.getProvider("tavily", mockEnv);
			expect(provider).toBeInstanceOf(TavilyProvider);
		});

		it("should create ParallelSearchProvider when provider is parallel", () => {
			const provider = SearchProviderFactory.getProvider("parallel", mockEnv, {
				id: 1,
			} as any);
			expect(provider).toBeInstanceOf(ParallelSearchProvider);
		});

		it("should create DuckDuckGoProvider when provider is duckduckgo", () => {
			const provider = SearchProviderFactory.getProvider("duckduckgo", mockEnv);
			expect(provider).toBeInstanceOf(DuckDuckGoProvider);
		});

		it("should throw error when serper provider is requested but API key is missing", () => {
			const envWithoutSerper = {
				...mockEnv,
				SERPER_API_KEY: undefined,
			} as IEnv;

			expect(() =>
				SearchProviderFactory.getProvider("serper", envWithoutSerper),
			).toThrow(expect.any(AssistantError));
			expect(() =>
				SearchProviderFactory.getProvider("serper", envWithoutSerper),
			).toThrow("SERPER_API_KEY is not set");
		});

		it("should throw error when tavily provider is requested but API key is missing", () => {
			const envWithoutTavily = {
				...mockEnv,
				TAVILY_API_KEY: undefined,
			} as IEnv;

			expect(() =>
				SearchProviderFactory.getProvider("tavily", envWithoutTavily),
			).toThrow(expect.any(AssistantError));
			expect(() =>
				SearchProviderFactory.getProvider("tavily", envWithoutTavily),
			).toThrow("TAVILY_API_KEY is not set");
		});

		it("should throw error when parallel provider requested but AI gateway token missing", () => {
			const envWithoutGateway = {
				...mockEnv,
				AI_GATEWAY_TOKEN: undefined,
			} as IEnv;

			expect(() =>
				SearchProviderFactory.getProvider("parallel", envWithoutGateway),
			).toThrow(expect.any(AssistantError));
			expect(() =>
				SearchProviderFactory.getProvider("parallel", envWithoutGateway),
			).toThrow("AI_GATEWAY_TOKEN is not set");
		});

		it("should throw error for unknown provider", () => {
			expect(() =>
				SearchProviderFactory.getProvider("unknown" as any, mockEnv),
			).toThrow(expect.any(AssistantError));
			expect(() =>
				SearchProviderFactory.getProvider("unknown" as any, mockEnv),
			).toThrow("Unknown search provider: unknown");
		});
	});
});
