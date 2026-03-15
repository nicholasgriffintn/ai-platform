import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl, resolveSandboxModel } from "../worker";

describe("resolveApiBaseUrl", () => {
	it("uses API_BASE_URL", () => {
		const env = {
			API_BASE_URL: "http://localhost:8787",
		} as any;

		expect(resolveApiBaseUrl(env)).toBe("http://localhost:8787");
	});

	it("falls back to production API URL when API_BASE_URL is missing", () => {
		const env = {} as any;

		expect(resolveApiBaseUrl(env)).toBe("https://api.polychat.app");
	});
});

describe("resolveSandboxModel", () => {
	it("uses requested model when allowed by policy", async () => {
		const context = {
			env: {
				SANDBOX_ALLOWED_MODELS: "mistral-large,gpt-4.1",
			},
			repositories: {
				userSettings: {
					getUserSettings: async () => ({ sandbox_model: "gpt-4.1" }),
				},
			},
		} as any;

		const model = await resolveSandboxModel({
			context,
			userId: 1,
			model: "mistral-large",
		});
		expect(model).toBe("mistral-large");
	});

	it("rejects blocked models", async () => {
		const context = {
			env: {
				SANDBOX_BLOCKED_MODELS: "mistral-large",
			},
			repositories: {
				userSettings: {
					getUserSettings: async () => ({ sandbox_model: null }),
				},
			},
		} as any;

		await expect(
			resolveSandboxModel({
				context,
				userId: 1,
				model: "mistral-large",
			}),
		).rejects.toThrow(/blocked by policy/);
	});
});
