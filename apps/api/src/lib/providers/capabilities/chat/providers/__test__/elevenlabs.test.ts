import { describe, expect, it, vi } from "vitest";
import { ElevenLabsProvider } from "../elevenlabs";

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
			return "test-elevenlabs-key";
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

describe("ElevenLabsProvider", () => {
	describe("validateParams", () => {
		it("requires AI_GATEWAY_TOKEN", () => {
			const provider = new ElevenLabsProvider();
			const params = {
				model: "eleven_multilingual_v2",
				message: "Hello",
				env: { ELEVENLABS_API_KEY: "test-elevenlabs-key" },
			};

			expect(() => {
				// @ts-ignore - protected method
				provider.validateParams(params as any);
			}).toThrow("Missing AI_GATEWAY_TOKEN");
		});
	});

	describe("getHeaders", () => {
		it("uses xi-api-key and does not send Authorization", async () => {
			const provider = new ElevenLabsProvider();
			const params = {
				model: "eleven_multilingual_v2",
				message: "Hello",
				env: {
					ELEVENLABS_API_KEY: "test-elevenlabs-key",
					AI_GATEWAY_TOKEN: "test-gateway-token",
				},
			};

			// @ts-ignore - protected method
			const headers = await provider.getHeaders(params as any);

			expect(headers["xi-api-key"]).toBe("test-elevenlabs-key");
			expect(headers.Authorization).toBeUndefined();
			expect(headers.authorization).toBeUndefined();
			expect(headers["cf-aig-authorization"]).toBe("test-gateway-token");
			expect(headers["Content-Type"]).toBe("application/json");
		});
	});
});
