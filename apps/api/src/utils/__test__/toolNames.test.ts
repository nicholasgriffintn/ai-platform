import { describe, expect, it } from "vitest";

import {
	getToolDefinitionName,
	hasEnabledToolNames,
	mergeToolDefinitionsByName,
	type ToolDefinitionLike,
} from "../toolNames";

describe("toolNames", () => {
	it("reads names from direct and function-shaped tool definitions", () => {
		expect(getToolDefinitionName({ name: "web_search" })).toBe("web_search");
		expect(getToolDefinitionName({ function: { name: "get_weather" } })).toBe("get_weather");
		expect(getToolDefinitionName({ name: 123 })).toBeUndefined();
	});

	it("merges tool definitions without duplicating names", () => {
		const first: ToolDefinitionLike = { name: "web_search", type: "hosted" };
		const duplicate: ToolDefinitionLike = { function: { name: "web_search" }, type: "function" };
		const second: ToolDefinitionLike = { function: { name: "get_weather" } };

		expect(mergeToolDefinitionsByName([first], [duplicate, second])).toEqual([first, second]);
	});

	it("keeps unnamed tool definitions", () => {
		const unnamed = { type: "custom" };

		expect(mergeToolDefinitionsByName([unnamed], [unnamed])).toEqual([unnamed, unnamed]);
	});

	it("detects configured enabled tool names", () => {
		expect(hasEnabledToolNames(["get_weather"])).toBe(true);
		expect(hasEnabledToolNames([""])).toBe(false);
		expect(hasEnabledToolNames([])).toBe(false);
		expect(hasEnabledToolNames(undefined)).toBe(false);
	});
});
