import { describe, expect, it } from "vitest";

import {
	buildMobileRedirectUri,
	createMobileOAuthState,
	isAllowedMobileRedirectUri,
	parseMobileOAuthState,
	requireMobileRedirectUri,
} from "../mobile";

describe("mobile auth helpers", () => {
	it("allows only the Polychat auth callback paths", () => {
		expect(isAllowedMobileRedirectUri("polychat://auth/callback", "/callback")).toBe(true);
		expect(isAllowedMobileRedirectUri("polychat://auth/magic-link", "/magic-link")).toBe(true);
		expect(isAllowedMobileRedirectUri("polychat://auth/magic-link", "/callback")).toBe(false);
		expect(isAllowedMobileRedirectUri("https://polychat.app/auth/callback", "/callback")).toBe(
			false,
		);
		expect(
			isAllowedMobileRedirectUri("polychat://auth/callback?next=https://example.com", "/callback"),
		).toBe(false);
		expect(isAllowedMobileRedirectUri("polychat://user:pass@auth/callback", "/callback")).toBe(
			false,
		);
		expect(isAllowedMobileRedirectUri("polychat://evil/callback", "/callback")).toBe(false);
	});

	it("throws for invalid mobile redirects", () => {
		expect(() => requireMobileRedirectUri("https://example.com/callback", "/callback")).toThrow(
			"Invalid mobile redirect URI",
		);
	});

	it("round-trips mobile OAuth state", () => {
		const redirectUri = "polychat://auth/callback";
		const state = createMobileOAuthState(redirectUri);

		expect(parseMobileOAuthState(state)).toEqual({
			platform: "mobile",
			redirect_uri: redirectUri,
		});
	});

	it("appends callback parameters without replacing the redirect target", () => {
		const redirectUri = buildMobileRedirectUri("polychat://auth/callback", {
			code: "abc.123",
		});

		expect(redirectUri).toBe("polychat://auth/callback?code=abc.123");
	});
});
