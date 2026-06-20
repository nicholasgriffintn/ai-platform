import { afterEach, describe, expect, it, vi } from "vitest";

import { generateOAuthPkceChallenge } from "../oauth";

describe("generateOAuthPkceChallenge", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("generates a URL-safe verifier and SHA-256 challenge", async () => {
		const getRandomValues = vi.fn((bytes: Uint8Array) => {
			for (let index = 0; index < bytes.length; index++) {
				bytes[index] = index + 1;
			}
			return bytes;
		});
		vi.stubGlobal("crypto", {
			getRandomValues,
			subtle: crypto.subtle,
		});

		const challenge = await generateOAuthPkceChallenge();

		expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
		expect(challenge).toEqual({
			codeVerifier: "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA",
			codeChallenge: "658WgAyQKf_KhWlXY9I8Os5xARz0DpNUrNgQIF4lD4c",
			codeChallengeMethod: "S256",
		});
	});

	it("requires secure random values", async () => {
		vi.stubGlobal("crypto", {});

		await expect(generateOAuthPkceChallenge()).rejects.toThrow(
			"Secure random generator unavailable",
		);
	});
});
