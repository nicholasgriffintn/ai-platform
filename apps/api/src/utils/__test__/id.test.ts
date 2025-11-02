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

		it("should fallback to Math.random when crypto is not available", () => {
			vi.stubGlobal("crypto", undefined);
			vi.spyOn(Math, "random").mockReturnValue(0.123456789);

			const result = generateId();

			expect(Math.random).toHaveBeenCalled();
			expect(result).toHaveLength(36);
			expect(result).toMatch(
				/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/,
			);
		});

		it("should fallback to Math.random when crypto.randomUUID is not a function", () => {
			vi.stubGlobal("crypto", { randomUUID: "not a function" });
			vi.spyOn(Math, "random").mockReturnValue(0.987654321);

			const result = generateId();

			expect(Math.random).toHaveBeenCalled();
			expect(result).toHaveLength(36);
			expect(result).toMatch(
				/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/,
			);
		});

		it("should generate different IDs on subsequent calls with Math.random fallback", () => {
			vi.stubGlobal("crypto", undefined);
			vi.spyOn(Math, "random")
				.mockReturnValueOnce(0.123456789)
				.mockReturnValueOnce(0.987654321);

			const result1 = generateId();
			const result2 = generateId();

			expect(result1).not.toBe(result2);
			expect(result1).toHaveLength(36);
			expect(result2).toHaveLength(36);
			expect(result1).toMatch(
				/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/,
			);
			expect(result2).toMatch(
				/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/,
			);
		});

		it("should generate IDs with correct length when using Math.random fallback", () => {
			vi.stubGlobal("crypto", undefined);
			vi.spyOn(Math, "random").mockReturnValue(0.5);

			const result = generateId();

			expect(result).toHaveLength(36);
			expect(result).toMatch(
				/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/,
			);
		});

		it("should generate valid UUID format when crypto.randomUUID is available", () => {
			const mockUUID = "550e8400-e29b-41d4-a716-446655440000";
			const mockCrypto = {
				randomUUID: vi.fn().mockReturnValue(mockUUID),
			};

			vi.stubGlobal("crypto", mockCrypto);

			const result = generateId();

			expect(result).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
			);
		});
	});
});
