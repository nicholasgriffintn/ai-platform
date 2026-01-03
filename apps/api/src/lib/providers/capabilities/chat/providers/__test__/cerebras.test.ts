import { describe, expect, it } from "vitest";
import { CerebrasProvider } from "../cerebras";

describe("CerebrasProvider", () => {
	describe("validateParams", () => {
		it("should require AI_GATEWAY_TOKEN", () => {
			const provider = new CerebrasProvider();

			const paramsWithoutGateway = {
				model: "llama3.1-8b",
				messages: [{ role: "user", content: "Hello" }],
				env: { CEREBRAS_API_KEY: "test-key" },
			};

			expect(() => {
				// @ts-ignore - validateParams is protected
				provider.validateParams(paramsWithoutGateway as any);
			}).toThrow("Missing AI_GATEWAY_TOKEN");
		});
	});

	describe("getEndpoint", () => {
		it("should use the AI Gateway chat completions endpoint", async () => {
			const provider = new CerebrasProvider();

			// @ts-ignore - getEndpoint is protected
			const endpoint = await provider.getEndpoint({} as any);

			expect(endpoint).toBe("chat/completions");
		});
	});

	describe("getHeaders", () => {
		it("should build AI Gateway headers", async () => {
			const provider = new CerebrasProvider();

			const params = {
				model: "llama3.1-8b",
				messages: [{ role: "user", content: "Hello" }],
				env: {
					CEREBRAS_API_KEY: "test-key",
					AI_GATEWAY_TOKEN: "test-token",
				},
			};

			// @ts-ignore - getHeaders is protected
			const headers = await provider.getHeaders(params as any);

			expect(headers.Authorization).toBe("Bearer test-key");
			expect(headers["cf-aig-authorization"]).toBe("test-token");
			expect(headers["Content-Type"]).toBe("application/json");
		});
	});
});
