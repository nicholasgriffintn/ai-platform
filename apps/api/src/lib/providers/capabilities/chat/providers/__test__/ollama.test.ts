import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import {
	createCommonParameters,
	getToolsForProvider,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { OllamaProvider } from "../ollama";

vi.mock("../base", () => ({
	BaseProvider: class MockBaseProvider {
		name = "mock";
		supportsStreaming = true;
		validateAiGatewayToken() {
			return true;
		}
		validateParams() {}
		async getApiKey() {
			return "test-key";
		}
	},
}));

vi.mock("~/lib/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/utils/parameters", () => ({
	createCommonParameters: vi.fn(),
	getToolsForProvider: vi.fn(),
	shouldEnableStreaming: vi.fn(),
}));

describe("OllamaProvider", () => {
	describe("mapParameters", () => {
		it("should create parameters with streaming disabled in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "llama2",
				type: ["text"],
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "llama2",
				temperature: 0.7,
				max_tokens: 1024,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({
				tools: [{ type: "function", function: { name: "test_tool" } }],
			});

			const provider = new OllamaProvider();

			const params = {
				model: "llama2",
				messages: [{ role: "user", content: "Hello" }],
				env: { OLLAMA_ENABLED: "true" },
			};

			const result = await provider.mapParameters(params as any);

			expect(result.model).toBe("llama2");
			expect(result.temperature).toBe(0.7);
			expect(result.max_tokens).toBe(1024);
			expect(result.tools).toEqual([
				{ type: "function", function: { name: "test_tool" } },
			]);
			expect(result.stream).toBeUndefined(); // streaming disabled
		});
	});

	describe("validateParams", () => {
		it("should validate OLLAMA_ENABLED requirement", async () => {
			const provider = new OllamaProvider();

			const paramsWithoutEnabled = {
				model: "llama2",
				messages: [{ role: "user", content: "Hello" }],
				env: {},
			};

			expect(() => {
				// @ts-ignore - validateParams is protected
				provider.validateParams(paramsWithoutEnabled as any);
			}).toThrow("Missing OLLAMA_ENABLED");

			const paramsWithEnabled = {
				model: "llama2",
				messages: [{ role: "user", content: "Hello" }],
				env: { OLLAMA_ENABLED: "true" },
			};

			expect(() => {
				// @ts-ignore - validateParams is protected
				provider.validateParams(paramsWithEnabled as any);
			}).not.toThrow();
		});
	});

	describe("getEndpoint", () => {
		it("should use custom OLLAMA_URL in endpoint", async () => {
			const provider = new OllamaProvider();

			const paramsWithCustomUrl = {
				model: "llama2",
				env: { OLLAMA_URL: "http://custom-ollama:11434" },
			};

			// @ts-ignore - getEndpoint is protected
			const endpoint = await provider.getEndpoint(paramsWithCustomUrl as any);

			expect(endpoint).toBe("http://custom-ollama:11434/api/chat");
		});

		it("should use default OLLAMA_URL when not provided", async () => {
			const provider = new OllamaProvider();

			const paramsWithoutUrl = {
				model: "llama2",
				env: {},
			};

			// @ts-ignore - getEndpoint is protected
			const endpoint = await provider.getEndpoint(paramsWithoutUrl as any);

			expect(endpoint).toBe("http://localhost:11434/api/chat");
		});
	});
});
