import { describe, expect, it, vi } from "vitest";
import { CertesiaProvider } from "../certesia";

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
			return "test-cartesia-key";
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

describe("CertesiaProvider", () => {
	describe("validateParams", () => {
		it("requires AI_GATEWAY_TOKEN", () => {
			const provider = new CertesiaProvider();

			expect(() => {
				// @ts-ignore - protected method
				provider.validateParams({
					model: "sonic",
					message: "Hello",
					env: { CARTESIA_API_KEY: "test-cartesia-key" },
				} as any);
			}).toThrow("Missing AI_GATEWAY_TOKEN");
		});
	});

	describe("getHeaders", () => {
		it("uses X-API-Key and removes Authorization", async () => {
			const provider = new CertesiaProvider();
			const params = {
				model: "sonic",
				message: "Hello",
				env: {
					CARTESIA_API_KEY: "test-cartesia-key",
					AI_GATEWAY_TOKEN: "test-gateway-token",
				},
			};

			// @ts-ignore - protected method
			const headers = await provider.getHeaders(params as any);

			expect(headers["X-API-Key"]).toBe("test-cartesia-key");
			expect(headers.Authorization).toBeUndefined();
			expect(headers.authorization).toBeUndefined();
			expect(headers["Cartesia-Version"]).toBe("2024-06-10");
			expect(headers["cf-aig-authorization"]).toBe("test-gateway-token");
		});
	});
});
