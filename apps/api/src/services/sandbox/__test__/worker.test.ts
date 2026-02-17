import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl } from "../worker";

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
