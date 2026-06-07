import { describe, expect, it } from "vitest";

import { parseJsonValue, stringifyEntries } from "./json.js";

describe("stringifyEntries", () => {
	it("drops undefined values and stringifies primitive values for provider APIs", () => {
		expect(
			stringifyEntries({
				model: "lizzy",
				epochs: 3,
				useSpotInstances: false,
				ignored: undefined,
			}),
		).toEqual({
			model: "lizzy",
			epochs: "3",
			useSpotInstances: "false",
		});
	});
});

describe("parseJsonValue", () => {
	it("parses stored JSON strings", () => {
		expect(parseJsonValue('{"status":"ok","count":2}')).toEqual({
			status: "ok",
			count: 2,
		});
	});

	it("returns undefined for empty, non-string, and invalid values", () => {
		expect(parseJsonValue("")).toBeUndefined();
		expect(parseJsonValue(null)).toBeUndefined();
		expect(parseJsonValue("{bad json")).toBeUndefined();
	});
});
