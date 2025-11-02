import { describe, expect, it } from "vitest";

import { decodeBase64Url, encodeBase64Url } from "../base64url";

describe("base64url", () => {
	describe("encodeBase64Url", () => {
		it("should encode buffer to base64url string", () => {
			const buffer = new Uint8Array([72, 101, 108, 108, 111]);

			const result = encodeBase64Url(buffer);
			expect(result).toBe("SGVsbG8");
		});

		it("should replace + with - and / with _", () => {
			const buffer = new Uint8Array([255, 255]);

			const result = encodeBase64Url(buffer);
			expect(result).not.toContain("+");
			expect(result).not.toContain("/");
			expect(result).toBe("__8");
		});

		it("should remove padding characters", () => {
			const buffer = new Uint8Array([72, 101]);

			const result = encodeBase64Url(buffer);
			expect(result).not.toContain("=");
			expect(result).toBe("SGU");
		});

		it("should handle empty buffer", () => {
			const buffer = new Uint8Array([]);

			const result = encodeBase64Url(buffer);
			expect(result).toBe("");
		});

		it("should handle single byte", () => {
			const buffer = new Uint8Array([65]);

			const result = encodeBase64Url(buffer);
			expect(result).toBe("QQ");
		});

		it("should handle binary data", () => {
			const buffer = new Uint8Array([255, 254, 253]);

			const result = encodeBase64Url(buffer);
			expect(result).toBe("__79");
		});
	});

	describe("decodeBase64Url", () => {
		it("should decode base64url string to buffer", () => {
			const base64Url = "SGVsbG8";

			const result = decodeBase64Url(base64Url);
			expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
		});

		it("should handle base64url with - and _", () => {
			const base64Url = "Pj8";

			const result = decodeBase64Url(base64Url);
			expect(result).toEqual(new Uint8Array([62, 63]));
		});

		it("should handle base64url without padding", () => {
			const base64Url = "SGU";

			const result = decodeBase64Url(base64Url);
			expect(result).toEqual(new Uint8Array([72, 101]));
		});

		it("should handle empty string", () => {
			const base64Url = "";

			const result = decodeBase64Url(base64Url);
			expect(result).toEqual(new Uint8Array([]));
		});

		it("should handle single character", () => {
			const base64Url = "QQ";

			const result = decodeBase64Url(base64Url);
			expect(result).toEqual(new Uint8Array([65]));
		});

		it("should handle base64url with URL-safe characters", () => {
			const base64Url = "__79";

			const result = decodeBase64Url(base64Url);
			expect(result).toEqual(new Uint8Array([255, 254, 253]));
		});
	});

	describe("round-trip conversion", () => {
		it("should maintain data integrity through round-trip conversion", () => {
			const originalData = new Uint8Array([
				72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 0, 1, 127, 128,
				254, 255, 62, 63,
			]);

			const base64Url = encodeBase64Url(originalData);
			const roundTrip = decodeBase64Url(base64Url);

			expect(roundTrip).toEqual(originalData);
		});

		it("should handle random binary data", () => {
			const originalData = new Uint8Array(100);
			for (let i = 0; i < 100; i++) {
				originalData[i] = Math.floor(Math.random() * 256);
			}

			const base64Url = encodeBase64Url(originalData);
			const roundTrip = decodeBase64Url(base64Url);

			expect(roundTrip).toEqual(originalData);
		});

		it("should produce URL-safe output", () => {
			const data = new Uint8Array(100);
			for (let i = 0; i < 100; i++) {
				data[i] = Math.floor(Math.random() * 256);
			}

			const base64Url = encodeBase64Url(data);

			expect(base64Url).not.toContain("+");
			expect(base64Url).not.toContain("/");
			expect(base64Url).not.toContain("=");
			expect(base64Url).toMatch(/^[A-Za-z0-9_-]*$/);
		});

		it("should handle JWT-like payloads", () => {
			const payload = JSON.stringify({
				sub: "1234567890",
				name: "John Doe",
				iat: 1516239022,
			});
			const originalData = new TextEncoder().encode(payload);

			const base64Url = encodeBase64Url(originalData);
			const roundTrip = decodeBase64Url(base64Url);
			const decodedPayload = new TextDecoder().decode(roundTrip);

			expect(JSON.parse(decodedPayload)).toEqual({
				sub: "1234567890",
				name: "John Doe",
				iat: 1516239022,
			});
		});
	});
});
