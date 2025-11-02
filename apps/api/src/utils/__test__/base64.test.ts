import { describe, expect, it } from "vitest";

import { base64ToBuffer, bufferToBase64 } from "../base64";

describe("base64", () => {
	describe("bufferToBase64", () => {
		it("should convert ArrayBuffer to base64 string", () => {
			const buffer = new ArrayBuffer(4);
			const view = new Uint8Array(buffer);
			view[0] = 72; // 'H'
			view[1] = 101; // 'e'
			view[2] = 108; // 'l'
			view[3] = 108; // 'l'

			const result = bufferToBase64(buffer);
			expect(result).toBe("SGVsbA==");
		});

		it("should convert Uint8Array to base64 string", () => {
			const buffer = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

			const result = bufferToBase64(buffer);
			expect(result).toBe("SGVsbG8=");
		});

		it("should handle empty buffer", () => {
			const buffer = new Uint8Array([]);

			const result = bufferToBase64(buffer);
			expect(result).toBe("");
		});

		it("should handle single byte", () => {
			const buffer = new Uint8Array([65]); // 'A'

			const result = bufferToBase64(buffer);
			expect(result).toBe("QQ==");
		});

		it("should handle binary data", () => {
			const buffer = new Uint8Array([0, 1, 254, 255]);

			const result = bufferToBase64(buffer);
			expect(result).toBe("AAH+/w==");
		});
	});

	describe("base64ToBuffer", () => {
		it("should convert base64 string to Uint8Array", () => {
			const base64 = "SGVsbA=="; // "Hell"

			const result = base64ToBuffer(base64);
			expect(result).toEqual(new Uint8Array([72, 101, 108, 108]));
		});

		it("should handle base64 without padding", () => {
			const base64 = "SGVsbG8"; // "Hello" without padding

			const result = base64ToBuffer(base64);
			expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
		});

		it("should handle empty base64 string", () => {
			const base64 = "";

			const result = base64ToBuffer(base64);
			expect(result).toEqual(new Uint8Array([]));
		});

		it("should handle single character base64", () => {
			const base64 = "QQ=="; // 'A'

			const result = base64ToBuffer(base64);
			expect(result).toEqual(new Uint8Array([65]));
		});

		it("should handle binary data base64", () => {
			const base64 = "AAH+/w=="; // [0, 1, 254, 255]

			const result = base64ToBuffer(base64);
			expect(result).toEqual(new Uint8Array([0, 1, 254, 255]));
		});
	});

	describe("round-trip conversion", () => {
		it("should maintain data integrity through round-trip conversion", () => {
			const originalData = new Uint8Array([
				72,
				101,
				108,
				108,
				111,
				32,
				87,
				111,
				114,
				108,
				100,
				33, // "Hello World!"
				0,
				1,
				127,
				128,
				254,
				255, // Some binary data
			]);

			const base64 = bufferToBase64(originalData);
			const roundTrip = base64ToBuffer(base64);

			expect(roundTrip).toEqual(originalData);
		});

		it("should handle random binary data", () => {
			const originalData = new Uint8Array(100);
			for (let i = 0; i < 100; i++) {
				originalData[i] = Math.floor(Math.random() * 256);
			}

			const base64 = bufferToBase64(originalData);
			const roundTrip = base64ToBuffer(base64);

			expect(roundTrip).toEqual(originalData);
		});

		it("should handle text data", () => {
			const text = "The quick brown fox jumps over the lazy dog";
			const originalData = new TextEncoder().encode(text);

			const base64 = bufferToBase64(originalData);
			const roundTrip = base64ToBuffer(base64);
			const decodedText = new TextDecoder().decode(roundTrip);

			expect(roundTrip).toEqual(originalData);
			expect(decodedText).toBe(text);
		});
	});
});
