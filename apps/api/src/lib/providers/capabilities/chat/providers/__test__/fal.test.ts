import { describe, expect, it, vi } from "vitest";
import { FalAIProvider } from "../fal";

vi.mock("../base", () => ({
	BaseProvider: class MockBaseProvider {
		name = "mock";
		supportsStreaming = false;
		isOpenAiCompatible = false;
		validateParams() {}
		validateAiGatewayToken() {}
		async getApiKey() {
			return "test-api-key";
		}
	},
}));

vi.mock("~/utils/aiGateway", () => ({
	getAiGatewayMetadataHeaders: vi.fn().mockReturnValue({ metadata: "test" }),
	resolveAiGatewayCacheTtl: vi.fn().mockReturnValue(3600),
}));

describe("FalAIProvider", () => {
	it("should have correct name", () => {
		const provider = new FalAIProvider();
		expect(provider.name).toBe("fal");
	});

	describe("getProviderKeyName", () => {
		it("should return FAL_KEY", () => {
			const provider = new FalAIProvider();
			// Access protected method via any
			expect((provider as any).getProviderKeyName()).toBe("FAL_KEY");
		});
	});

	describe("getEndpoint", () => {
		it("should return the model from params", async () => {
			const provider = new FalAIProvider();
			const params = { model: "fal-ai/qwen-image" };
			const endpoint = await (provider as any).getEndpoint(params);
			expect(endpoint).toBe("fal-ai/qwen-image");
		});
	});

	describe("getHeaders", () => {
		it("should return correct headers", async () => {
			const provider = new FalAIProvider();
			const params = {
				model: "fal-ai/qwen-image",
				env: { AI_GATEWAY_TOKEN: "gateway-token" },
				user: { id: "user-123" },
			};

			const headers = await (provider as any).getHeaders(params);

			expect(headers).toEqual(
				expect.objectContaining({
					"cf-aig-authorization": "gateway-token",
					Authorization: "Key test-api-key",
					"Content-Type": "application/json",
					"cf-aig-cache-ttl": "3600",
				}),
			);
		});
	});

	describe("mapParameters", () => {
		it("should combine messages into a single prompt", async () => {
			const provider = new FalAIProvider();
			const params = {
				model: "fal-ai/qwen-image",
				messages: [
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi" },
					{ role: "user", content: "Make an image" },
				],
			};

			const result = await provider.mapParameters(params as any);

			expect(result.prompt).toBe("Make an image");
		});

		it("should exclude non-text content from arrays", async () => {
			const provider = new FalAIProvider();
			const params = {
				model: "fal-ai/qwen-image",
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: "Describe this" },
							{ type: "image", image: "base64..." },
						],
					},
				],
			};

			const result = await provider.mapParameters(params as any);
			expect(result.prompt).toBe("Describe this");
		});
	});
});
