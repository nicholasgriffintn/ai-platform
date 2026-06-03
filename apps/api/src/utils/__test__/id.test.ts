import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateId } from "../id";

describe("id", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("generateId", () => {
		it("should use crypto.randomUUID when available", () => {
			const mockUUID = "123e4567-e89b-12d3-a456-426614174000";
			const mockCrypto = {
				randomUUID: vi.fn().mockReturnValue(mockUUID),
			};

			vi.stubGlobal("crypto", mockCrypto);

			const result = generateId();

			expect(mockCrypto.randomUUID).toHaveBeenCalled();
			expect(result).toBe(mockUUID);
		});

		it("should reject ID generation when crypto is not available", () => {
			vi.stubGlobal("crypto", undefined);

			expect(() => generateId()).toThrow("Secure random generator unavailable");
		});

		it("should fallback to crypto.getRandomValues when crypto.randomUUID is not a function", () => {
			const getRandomValues = vi.fn((array: Uint8Array) => {
				array.fill(0xab);
				return array;
			});
			vi.stubGlobal("crypto", {
				randomUUID: "not a function",
				getRandomValues,
			});

			const result = generateId();

			expect(getRandomValues).toHaveBeenCalled();
			expect(result).toHaveLength(36);
			expect(result).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
		});

		it("should generate different IDs on subsequent calls with crypto.getRandomValues fallback", () => {
			let fillValue = 0x11;
			const getRandomValues = vi.fn((array: Uint8Array) => {
				array.fill(fillValue);
				fillValue = 0x22;
				return array;
			});
			vi.stubGlobal("crypto", { getRandomValues });

			const result1 = generateId();
			const result2 = generateId();

			expect(result1).not.toBe(result2);
			expect(result1).toHaveLength(36);
			expect(result2).toHaveLength(36);
			expect(result1).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
			expect(result2).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
		});

		it("should generate IDs with correct length when using crypto.getRandomValues fallback", () => {
			const getRandomValues = vi.fn((array: Uint8Array) => {
				array.fill(0x55);
				return array;
			});
			vi.stubGlobal("crypto", { getRandomValues });

			const result = generateId();

			expect(result).toHaveLength(36);
			expect(result).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
		});

		it("should generate valid UUID format when crypto.randomUUID is available", () => {
			const mockUUID = "550e8400-e29b-41d4-a716-446655440000";
			const mockCrypto = {
				randomUUID: vi.fn().mockReturnValue(mockUUID),
			};

			vi.stubGlobal("crypto", mockCrypto);

			const result = generateId();

			expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		});
	});
});
