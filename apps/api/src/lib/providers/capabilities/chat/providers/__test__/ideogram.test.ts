import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { IdeogramProvider } from "../ideogram";

vi.mock("../base", () => ({
	BaseProvider: class MockBaseProvider {
		name = "mock";
		supportsStreaming = false;
		isOpenAiCompatible = false;
		validateParams() {}
		validateAiGatewayToken(params: { env?: { AI_GATEWAY_TOKEN?: string } }) {
			if (!params.env?.AI_GATEWAY_TOKEN) {
				throw new Error("Missing AI_GATEWAY_TOKEN");
			}
		}
		async getApiKey() {
			return "test-key";
		}
		buildAiGatewayHeaders(
			params: { env?: { AI_GATEWAY_TOKEN?: string } },
			apiKey: string,
		) {
			return {
				"cf-aig-authorization": params.env?.AI_GATEWAY_TOKEN || "",
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			};
		}
	},
}));

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

describe("IdeogramProvider", () => {
	describe("validateParams", () => {
		it("should require AI_GATEWAY_TOKEN", () => {
			const provider = new IdeogramProvider();

			const paramsWithoutGateway = {
				model: "ideogram/ideogram-v3",
				messages: [{ role: "user", content: "Hello" }],
				env: { IDEOGRAM_API_KEY: "test-key" },
			};

			expect(() => {
				// @ts-ignore - validateParams is protected
				provider.validateParams(paramsWithoutGateway as any);
			}).toThrow("Missing AI_GATEWAY_TOKEN");
		});
	});

	describe("getEndpoint", () => {
		it("should use the Ideogram v3 generate endpoint", async () => {
			const provider = new IdeogramProvider();

			// @ts-ignore - getEndpoint is protected
			const endpoint = await provider.getEndpoint({} as any);

			expect(endpoint).toBe("v1/ideogram-v3/generate");
		});
	});

	describe("getHeaders", () => {
		it("should build Ideogram gateway headers", async () => {
			const provider = new IdeogramProvider();

			const params = {
				model: "ideogram/ideogram-v3",
				messages: [{ role: "user", content: "Hello" }],
				env: {
					IDEOGRAM_API_KEY: "test-key",
					AI_GATEWAY_TOKEN: "test-token",
				},
			};

			// @ts-ignore - getHeaders is protected
			const headers = await provider.getHeaders(params as any);

			expect(headers["Api-Key"]).toBe("test-key");
			expect(headers["cf-aig-authorization"]).toBe("test-token");
			expect(headers["Content-Type"]).toBe("application/json");
		});
	});

	describe("mapParameters", () => {
		it("should map prompt and model for Ideogram v3", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				matchingModel: "V_3",
				inputSchema: {
					fields: [
						{
							name: "prompt",
							type: "string",
							required: true,
						},
					],
				},
			} as any);

			const provider = new IdeogramProvider();
			const params = {
				model: "ideogram/ideogram-v3",
				messages: [{ role: "user", content: "A cat" }],
				env: {
					IDEOGRAM_API_KEY: "test-key",
					AI_GATEWAY_TOKEN: "test-token",
				},
			};

			const result = await provider.mapParameters(params as any);

			expect(result).toEqual({
				prompt: "A cat",
				model: "V_3",
			});
		});
	});
});
