import { describe, expect, it } from "vitest";

import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";

describe("areUserIdsEqual", () => {
	it("matches the numeric auth response with string-backed client state", () => {
		expect(areUserIdsEqual(42, "42")).toBe(true);
		expect(areUserIdsEqual("42", 42)).toBe(true);
	});

	it("does not match missing or different users", () => {
		expect(areUserIdsEqual(undefined, undefined)).toBe(false);
		expect(areUserIdsEqual(42, 7)).toBe(false);
	});
});
