import { describe, expect, it } from "vitest";

import { hasAnyEnabledTool } from "../enabledTools";
import { coerceStringArray } from "../objects";
import { readOptionBag, readRecordOption } from "../options";

describe("option utilities", () => {
	it("returns only record-shaped option bags", () => {
		expect(readOptionBag({ image_generation: { size: "1024x1024" } })).toEqual({
			image_generation: { size: "1024x1024" },
		});
		expect(readOptionBag(["not", "record"])).toEqual({});
	});

	it("returns only record-shaped option values", () => {
		expect(readRecordOption({ nested: { enabled: true } }, "nested")).toEqual({
			enabled: true,
		});
		expect(readRecordOption({ nested: ["not", "record"] }, "nested")).toEqual({});
	});

	it("coerces strings and string arrays", () => {
		expect(coerceStringArray("single")).toEqual(["single"]);
		expect(coerceStringArray(["a", "b"])).toEqual(["a", "b"]);
		expect(coerceStringArray(["a", 1])).toEqual(["a"]);
		expect(coerceStringArray(undefined)).toEqual([]);
	});

	it("checks enabled tool aliases", () => {
		expect(hasAnyEnabledTool(["web_search"], "search_grounding", "web_search")).toBe(true);
		expect(hasAnyEnabledTool(["file_search"], "web_search")).toBe(false);
		expect(hasAnyEnabledTool(undefined, "web_search")).toBe(false);
	});
});
